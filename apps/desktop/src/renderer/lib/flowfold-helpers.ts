import type { AgentEvent } from "@insightify/agent-runtime";
import {
  isRoom,
  type FlowEdge,
  type FlowNode,
  type ExpandedRoomFrame,
  type GeneratedFlowGraph,
  type PortalPreview,
  type ProjectedFlowEdge,
  type ScopeBoundaryPort,
} from "@insightify/graph-domain";
import { PORTAL_CARD_WIDTH } from "../semantic-zoom.js";

export type ApprovalRequestedEvent = Extract<AgentEvent, { type: "approval.requested" }>;
export type ApprovalResolvedEvent = Extract<AgentEvent, { type: "approval.resolved" }>;
export type RoomEdge = ProjectedFlowEdge & { source: string; target: string };
export type VisualEdgeBundle = {
  key: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  count: number;
  bundled: boolean;
  members: RoomEdge[];
};

export type FrameProjection = {
  x(value: number): number;
  y(value: number): number;
  cardHalfWidth: number;
  cardHalfHeight: number;
};

export type PlacedPort = {
  port: ScopeBoundaryPort;
  chipX: number;
  chipY: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export const emptyPreview: PortalPreview = {
  nodes: [],
  edges: [],
  childCount: 0,
  descendantCount: 0,
  hiddenCount: 0,
};

export function isRoomEdge(edge: ProjectedFlowEdge): edge is RoomEdge {
  return edge.source !== null && edge.target !== null;
}

export function toFlowEdge(edge: RoomEdge): FlowEdge {
  return { source: edge.source, target: edge.target, label: edge.labels[0] ?? "" };
}

export function bundleEdgesByVisualArea(
  edges: RoomEdge[],
  nodes: Array<FlowNode & { x: number; y: number }>,
  scopeId: string | null,
  areaIds: Record<string, string>,
  frames: ExpandedRoomFrame[]
): VisualEdgeBundle[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const frameById = new Map(frames.map((frame) => [frame.roomId, frame]));
  const areaOf = (node: FlowNode) =>
    node.parentId !== scopeId && node.parentId
      ? `room:${node.parentId}`
      : `area:${areaIds[node.id] ?? node.id}`;
  const groups = new Map<string, RoomEdge[]>();

  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const sourceArea = areaOf(source);
    const targetArea = areaOf(target);
    // Preserve the topology inside one visual area; only inter-area traffic
    // becomes a trunk.
    const key =
      sourceArea === targetArea
        ? `edge:${edge.source}:${edge.target}`
        : `${sourceArea}->${targetArea}`;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, members]) => {
    const sources = members.map((edge) => byId.get(edge.source)!).filter(Boolean);
    const targets = members.map((edge) => byId.get(edge.target)!).filter(Boolean);
    const average = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    let sourceX = average(sources.map((node) => node.x));
    let sourceY = average(sources.map((node) => node.y));
    let targetX = average(targets.map((node) => node.x));
    let targetY = average(targets.map((node) => node.y));
    const sourceParents = new Set(sources.map((node) => node.parentId));
    const targetParents = new Set(targets.map((node) => node.parentId));
    const count = members.reduce((sum, edge) => sum + edge.count, 0);
    const bundled = members.length > 1 || count > 1;

    if (bundled && sourceParents.size === 1) {
      const parentId = sources[0]?.parentId;
      const frame = parentId ? frameById.get(parentId) : undefined;
      if (frame) {
        sourceX = targetX >= sourceX
          ? frame.bounds.x + frame.bounds.width
          : frame.bounds.x;
        sourceY = Math.min(
          frame.contentBounds.y + frame.contentBounds.height,
          Math.max(frame.contentBounds.y, sourceY)
        );
      }
    }
    if (bundled && targetParents.size === 1) {
      const parentId = targets[0]?.parentId;
      const frame = parentId ? frameById.get(parentId) : undefined;
      if (frame) {
        targetX = sourceX <= targetX
          ? frame.bounds.x
          : frame.bounds.x + frame.bounds.width;
        targetY = Math.min(
          frame.contentBounds.y + frame.contentBounds.height,
          Math.max(frame.contentBounds.y, targetY)
        );
      }
    }

    return {
      key,
      sourceX,
      sourceY,
      targetX,
      targetY,
      count,
      bundled,
      members,
    };
  });
}

export function connectionSides(
  nodeId: string,
  edges: RoomEdge[],
  ports: ScopeBoundaryPort[]
): { input: boolean; output: boolean } {
  return {
    input:
      edges.some((edge) => edge.target === nodeId) ||
      ports.some((port) => port.side === "input" && port.nodeId === nodeId),
    output:
      edges.some((edge) => edge.source === nodeId) ||
      ports.some((port) => port.side === "output" && port.nodeId === nodeId),
  };
}

export function portKey(port: ScopeBoundaryPort): string {
  return `${port.side}-${port.nodeId}`;
}

export function frameProjection(
  stageWidth: number,
  stageHeight: number,
  scale: number,
  frame: { width: number; height: number }
): FrameProjection {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  return {
    x: (value) => 50 + ((value - 50) * (stageWidth * scale)) / width,
    y: (value) => 50 + ((value - 50) * (stageHeight * scale)) / height,
    cardHalfWidth: ((PORTAL_CARD_WIDTH / 2) * scale * 100) / width,
    cardHalfHeight: (98 * scale * 100) / height,
  };
}

export function layoutBoundaryRail(
  ports: ScopeBoundaryPort[],
  nodes: Array<{ id: string; x: number; y: number }>,
  project: FrameProjection
): PlacedPort[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const bandTop = Math.min(...nodes.map((node) => project.y(node.y))) - project.cardHalfHeight;
  const placed: PlacedPort[] = [];

  for (const side of ["input", "output"] as const) {
    const chipX = side === "input" ? 4 : 96;
    ports
      .filter((port) => port.side === side && byId.has(port.nodeId))
      .sort((left, right) => byId.get(left.nodeId)!.x - byId.get(right.nodeId)!.x)
      .forEach((port, index) => {
        const node = byId.get(port.nodeId)!;
        placed.push({
          port,
          chipX,
          chipY: Math.max(4, bandTop - 5 - index * 4),
          fromX: chipX,
          fromY: Math.max(4, bandTop - 5 - index * 4),
          toX: project.x(node.x) + (side === "input" ? -project.cardHalfWidth : project.cardHalfWidth),
          toY: project.y(node.y),
        });
      });
  }
  return placed;
}

export function ancestorWithin(
  graph: GeneratedFlowGraph | null,
  from: string | null,
  scopeId: string | null
): string | null {
  const visited = new Set<string>();
  let cursor = from;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = graph?.graph.nodes.find((item) => item.id === cursor);
    if (!node) return null;
    if (node.parentId === scopeId) return node.id;
    cursor = node.parentId;
  }
  return null;
}

export function buildScopePath(
  graph: GeneratedFlowGraph | null,
  scopeId: string | null
): FlowNode[] {
  if (!graph || !scopeId) return [];
  const result: FlowNode[] = [];
  let cursor: string | null = scopeId;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = graph.graph.nodes.find((item) => item.id === cursor);
    if (!node) break;
    result.unshift(node);
    cursor = node.parentId;
  }
  return result;
}

export function descendantIds(nodes: FlowNode[], rootId: string): Set<string> {
  const result = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function clearDive(timers: { current: ReturnType<typeof setTimeout>[] }): void {
  timers.current.forEach(clearTimeout);
  timers.current = [];
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function parseEvidence(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((item) => item.slice(0, 240));
}

export function nodeTitle(nodes: FlowNode[], id: string): string {
  return nodes.find((node) => node.id === id)?.title ?? id;
}

export function generationPhase(events: AgentEvent[], transcript: string): string {
  if (transcript) return "Streaming structured graph";
  if (events.some((event) => event.type === "reasoning.delta")) return "Model thinking & structuring";
  if (events.some((event) => event.type === "tool.started")) return "Executing agent inspection";
  if (events.some((event) => event.type === "run.started")) return "Analyzing project snapshot";
  if (events.some((event) => event.type === "provider.connected")) return "Provider connected";
  return "Preparing safe snapshot";
}

export function extractStreamValues(text: string, key: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g");
  for (const match of text.matchAll(pattern)) {
    try {
      values.push(JSON.parse(`"${match[1]}"`) as string);
    } catch {
      values.push(match[1]);
    }
  }
  return values;
}

export function kindIcon(kind: string): string {
  return (
    ({
      room: "↳",
      process: "→",
      decision: "◇",
      data: "▤",
      external: "↗",
    } as Record<string, string>)[kind] ?? "·"
  );
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isApprovalRequested(event: AgentEvent): event is ApprovalRequestedEvent {
  return event.type === "approval.requested";
}

export function isApprovalResolved(event: AgentEvent): event is ApprovalResolvedEvent {
  return event.type === "approval.resolved";
}

/**
 * Determines whether a node should render an avatar icon above its compact pill.
 * If multiple sibling nodes in the same scope share the same kind (e.g. repeated API endpoints),
 * the individual avatar is omitted to reduce clutter and keep the list clean.
 */
export function shouldShowNodeAvatar(node: FlowNode, visibleNodes: FlowNode[]): boolean {
  // Always show avatar for Room portals
  if (isRoom(node)) return true;

  // Find siblings belonging to the same scope / parent
  const siblings = visibleNodes.filter((n) => n.parentId === node.parentId);
  
  // If there are multiple nodes of the exact same kind in this scope, omit the repeated icon
  const sameKindCount = siblings.filter((n) => n.kind === node.kind).length;
  if (sameKindCount > 1) {
    return false;
  }

  return true;
}
