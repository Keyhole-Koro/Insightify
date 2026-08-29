import { z } from "zod";
import { defaultRoomLayoutRules, layoutNodesWithAreaDSL, type ExpandedRoomFrame } from "./area-layout.js";

export * from "./area-layout.js";

export const flowNodeKindSchema = z.enum([
  "room",
  "api",
  "ui",
  "service",
  "database",
  "queue",
  "auth",
  "decision",
  "external",
  // Backward compatibility
  "process",
  "data",
]);

export const flowNodeStatusSchema = z.enum(["idle", "working", "ready", "error"]);

export const flowNodeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  title: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(240),
  kind: flowNodeKindSchema,
  parentId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).nullable(),
  evidence: z.array(z.string().trim().min(1).max(240)).max(4),
  tags: z.array(z.string().trim().min(1).max(30)).max(6).optional(),
  status: flowNodeStatusSchema.optional(),
  technology: z.string().trim().max(40).optional(),
  codeSnippet: z.string().trim().max(600).optional(),
});
export type FlowNodeStatus = z.infer<typeof flowNodeStatusSchema>;

export const flowEdgeSchema = z.object({
  source: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  target: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().max(60),
});

export const flowGraphSchema = z.object({
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(400),
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
}).superRefine((graph, context) => {
  const ids = new Set<string>();
  graph.nodes.forEach((node, index) => {
    if (ids.has(node.id)) {
      context.addIssue({ code: "custom", path: ["nodes", index, "id"], message: `Duplicate node id: ${node.id}` });
    }
    ids.add(node.id);
  });
  graph.nodes.forEach((node, index) => {
    if (node.parentId && !ids.has(node.parentId)) {
      context.addIssue({ code: "custom", path: ["nodes", index, "parentId"], message: `Unknown parent: ${node.parentId}` });
    }
    if (node.parentId === node.id) {
      context.addIssue({ code: "custom", path: ["nodes", index, "parentId"], message: "A node cannot parent itself" });
    }
  });
  graph.edges.forEach((edge, index) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      context.addIssue({ code: "custom", path: ["edges", index], message: "Edge references an unknown node" });
    }
    if (edge.source === edge.target) {
      context.addIssue({ code: "custom", path: ["edges", index], message: "Self edges are not allowed" });
    }
  });
});

export type FlowNodeKind = z.infer<typeof flowNodeKindSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowGraph = z.infer<typeof flowGraphSchema>;

export const flowGraphExpansionSchema = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
});
export type FlowGraphExpansion = z.infer<typeof flowGraphExpansionSchema>;

export const flowNodePositionSchema = z.object({
  x: z.number().min(4).max(96),
  y: z.number().min(8).max(92),
});
export const graphLayoutSchema = z.record(z.string(), flowNodePositionSchema);
export type FlowNodePosition = z.infer<typeof flowNodePositionSchema>;
export type GraphLayout = z.infer<typeof graphLayoutSchema>;

export const generatedFlowGraphSchema = z.object({
  projectId: z.string().uuid(),
  provider: z.enum(["codex", "antigravity-cli"]),
  snapshotHash: z.string().min(1).max(128),
  generatedAt: z.string().min(1).max(64),
  graph: flowGraphSchema,
  layout: graphLayoutSchema,
  layoutVersion: z.literal(2).optional(),
});
export type GeneratedFlowGraph = z.infer<typeof generatedFlowGraphSchema>;

export type PositionedFlowNode = FlowNode & { x: number; y: number };
export type ProjectedFlowEdge = {
  source: string | null;
  target: string | null;
  sourceOutsideId: string | null;
  targetOutsideId: string | null;
  labels: string[];
  count: number;
};
export type ScopeProjection = {
  nodes: FlowNode[];
  edges: ProjectedFlowEdge[];
};
export type BoundaryEndpoint = { id: string; title: string; label: string };
export type ScopeBoundaryPort = {
  side: "input" | "output";
  nodeId: string;
  endpoints: BoundaryEndpoint[];
  count: number;
};
export type PortalPreviewNode = PositionedFlowNode & { isEntry: boolean; isExit: boolean };
export type PortalPreview = {
  nodes: PortalPreviewNode[];
  edges: Array<{ source: string; target: string }>;
  childCount: number;
  descendantCount: number;
  hiddenCount: number;
};

export const FLOWFOLD_ROOM_MAX_NODES = 7;
export const PORTAL_PREVIEW_MAX_NODES = 5;

export const FLOW_GRAPH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "nodes", "edges"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 80 },
    summary: { type: "string", minLength: 1, maxLength: 400 },
    nodes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "summary", "kind", "parentId", "evidence"],
        properties: {
          id: { type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" },
          title: { type: "string", minLength: 1, maxLength: 60 },
          summary: { type: "string", minLength: 1, maxLength: 240 },
          kind: { type: "string", enum: ["room", "process", "decision", "data", "external"] },
          parentId: { anyOf: [{ type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" }, { type: "null" }] },
          evidence: { type: "array", maxItems: 4, items: { type: "string", minLength: 1, maxLength: 240 } },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "target", "label"],
        properties: {
          source: { type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" },
          target: { type: "string", pattern: "^[a-z][a-z0-9-]{0,39}$" },
          label: { type: "string", maxLength: 60 },
        },
      },
    },
  },
} as const;

export const FLOW_GRAPH_EXPANSION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nodes", "edges"],
  properties: {
    nodes: {
      type: "array",
      minItems: 1,
      items: FLOW_GRAPH_JSON_SCHEMA.properties.nodes.items,
    },
    edges: {
      type: "array",
      items: FLOW_GRAPH_JSON_SCHEMA.properties.edges.items,
    },
  },
} as const;

export function parseFlowGraph(value: unknown): FlowGraph {
  return flowGraphSchema.parse(value);
}

export function parseGeneratedFlowGraph(value: unknown): GeneratedFlowGraph {
  return generatedFlowGraphSchema.parse(value);
}

export function parseFlowGraphText(text: string): FlowGraph {
  return parseFlowGraph(JSON.parse(unfenceJson(text)));
}

export function parseFlowGraphExpansion(value: unknown): FlowGraphExpansion {
  return flowGraphExpansionSchema.parse(value);
}

export function parseFlowGraphExpansionText(text: string): FlowGraphExpansion {
  return parseFlowGraphExpansion(JSON.parse(unfenceJson(text)));
}

export function layoutRootNodes(graph: FlowGraph): PositionedFlowNode[] {
  const roots = graph.nodes.filter((node) => node.parentId === null);
  const visible = roots.length > 0 ? roots : graph.nodes;
  return layoutFlowNodes(visible, graph.edges);
}

export function layoutFlowNodes(
  visible: FlowNode[],
  edges: FlowEdge[] = [],
  roomId: string | null = null
): PositionedFlowNode[] {
  if (visible.length === 0) return [];
  // Use the Recursive Area Layout DSL
  return layoutNodesWithAreaDSL(visible, roomId, defaultRoomLayoutRules, edges);
}

export function createDefaultGraphLayout(graph: FlowGraph, existing: GraphLayout = {}): GraphLayout {
  const layout: GraphLayout = { ...existing };
  const parentIds = new Set<string | null>([null, ...graph.nodes.map((node) => node.parentId)]);
  for (const parentId of parentIds) {
    const nodes = graph.nodes.filter((node) => node.parentId === parentId);
    const projection = projectFlowToScope(graph, parentId);
    const projectedEdges = projection.edges
      .filter((edge): edge is ProjectedFlowEdge & { source: string; target: string } => edge.source !== null && edge.target !== null)
      .map((edge) => ({ source: edge.source, target: edge.target, label: edge.labels[0] ?? "" }));
    for (const node of layoutFlowNodes(nodes, projectedEdges, parentId)) {
      if (!layout[node.id]) layout[node.id] = { x: node.x, y: node.y };
    }
  }
  return layout;
}

// A Room shows one generation of nodes, but an edge may start or end many levels
// deeper. Both are answered by the same question: which node of this Room, if
// any, does an arbitrary node belong to?
function scopeRepresentative(graph: FlowGraph, scopeId: string | null): (nodeId: string) => string | null {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return (nodeId: string): string | null => {
    let cursor = byId.get(nodeId);
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      if (cursor.parentId === scopeId) return cursor.id;
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return null;
  };
}

export function projectFlowToScope(graph: FlowGraph, scopeId: string | null): ScopeProjection {
  const nodes = graph.nodes.filter((node) => node.parentId === scopeId);
  const representative = scopeRepresentative(graph, scopeId);

  const projected = new Map<string, ProjectedFlowEdge>();
  for (const edge of graph.edges) {
    const source = representative(edge.source);
    const target = representative(edge.target);
    if (source === target) continue;
    if (source === null && target === null) continue;
    const key = `${source ?? "outside"}\u0000${target ?? "outside"}`;
    const current = projected.get(key);
    if (current) {
      current.count += 1;
      if (edge.label && !current.labels.includes(edge.label)) current.labels.push(edge.label);
      continue;
    }
    projected.set(key, {
      source,
      target,
      sourceOutsideId: source === null ? edge.source : null,
      targetOutsideId: target === null ? edge.target : null,
      labels: edge.label ? [edge.label] : [],
      count: 1,
    });
  }
  return { nodes, edges: [...projected.values()] };
}

export function balanceFlowGraphScopes(graph: FlowGraph, maximum = FLOWFOLD_ROOM_MAX_NODES): FlowGraph {
  if (maximum < 2) throw new Error("A FlowFold Room must allow at least two nodes");
  let nodes = graph.nodes.map((node) => ({ ...node }));
  const usedIds = new Set(nodes.map((node) => node.id));
  const queue: Array<string | null> = [null, ...nodes.map((node) => node.id)];
  for (let index = 0; index < queue.length; index += 1) {
    const parentId = queue[index];
    const children = nodes.filter((node) => node.parentId === parentId);
    if (children.length <= maximum) continue;
    const overflow = children.slice(maximum - 1);
    const baseId = parentId ? `${parentId}-continued` : "continued-flow";
    const roomId = uniqueNodeId(baseId, usedIds);
    usedIds.add(roomId);
    const room: FlowNode = {
      id: roomId,
      title: "Continued flow",
      summary: `Groups ${overflow.length} additional steps so this Room stays readable.`,
      kind: "room",
      parentId,
      evidence: [...new Set(overflow.flatMap((node) => node.evidence))].slice(0, 4),
    };
    nodes = [...nodes.map((node) => overflow.some((item) => item.id === node.id) ? { ...node, parentId: roomId } : node), room];
    queue.push(roomId);
    index -= 1;
  }
  return parseFlowGraph({ ...graph, nodes });
}

// Entering a Room must not cut the flow. Edges that leave the Room stay visible
// as a port on the boundary, named after the node on the other side.
export function scopeBoundaryPorts(graph: FlowGraph, scopeId: string | null): ScopeBoundaryPort[] {
  const representative = scopeRepresentative(graph, scopeId);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const ports = new Map<string, ScopeBoundaryPort>();
  const add = (side: "input" | "output", nodeId: string, outsideId: string, label: string) => {
    const key = `${side}\u0000${nodeId}`;
    const port = ports.get(key) ?? { side, nodeId, endpoints: [], count: 0 };
    port.count += 1;
    if (!port.endpoints.some((endpoint) => endpoint.id === outsideId)) {
      port.endpoints.push({ id: outsideId, title: byId.get(outsideId)?.title ?? outsideId, label });
    }
    ports.set(key, port);
  };
  const inside = graph.nodes.filter((node) => node.parentId === scopeId).map((node) => node.id);
  const fed = new Set<string>();
  const feeding = new Set<string>();
  for (const edge of graph.edges) {
    const source = representative(edge.source);
    const target = representative(edge.target);
    if (source !== null && target !== null && source !== target) { fed.add(target); feeding.add(source); }
  }
  const entries = inside.filter((id) => !fed.has(id));
  const exits = inside.filter((id) => !feeding.has(id));
  const orFirst = (candidates: string[]) => (candidates.length > 0 ? candidates : inside.slice(0, 1));

  for (const edge of graph.edges) {
    const source = representative(edge.source);
    const target = representative(edge.target);
    if (source === null && target !== null) add("input", target, edge.source, edge.label);
    else if (target === null && source !== null) add("output", source, edge.target, edge.label);
    else if (source === null && target === null && scopeId !== null) {
      // The Room node itself is the endpoint. Hand that connection to the nodes
      // that open and close the flow inside, so the order survives the descent.
      if (edge.target === scopeId) for (const id of orFirst(entries)) add("input", id, edge.source, edge.label);
      if (edge.source === scopeId) for (const id of orFirst(exits)) add("output", id, edge.target, edge.label);
    }
  }
  return [...ports.values()];
}

// A Portal is a folded sheet of paper, not a link: it shows a miniature of the
// flow inside it. This is a summary snapshot, never a live child canvas.
export function buildPortalPreview(graph: FlowGraph, nodeId: string, limit = PORTAL_PREVIEW_MAX_NODES): PortalPreview {
  const children = graph.nodes.filter((node) => node.parentId === nodeId);
  const descendantCount = descendantCountOf(graph, nodeId);
  if (children.length === 0) {
    return { nodes: [], edges: [], childCount: 0, descendantCount, hiddenCount: 0 };
  }
  const projection = projectFlowToScope(graph, nodeId);
  const inside = projection.edges.filter(
    (edge): edge is ProjectedFlowEdge & { source: string; target: string } => edge.source !== null && edge.target !== null,
  );
  const positioned = layoutFlowNodes(children, inside.map((edge) => ({ source: edge.source, target: edge.target, label: "" })));
  const entries = new Set(projection.edges.filter((edge) => edge.source === null && edge.target).map((edge) => edge.target!));
  const exits = new Set(projection.edges.filter((edge) => edge.target === null && edge.source).map((edge) => edge.source!));

  // Reading order first, so the miniature keeps the shape of the real flow when
  // it has to drop nodes.
  const ordered = [...positioned].sort((left, right) => left.x - right.x || left.y - right.y);
  const selected = ordered.slice(0, Math.max(1, limit));
  const selectedIds = new Set(selected.map((node) => node.id));
  const xs = selected.map((node) => node.x);
  const ys = selected.map((node) => node.y);
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const spanX = span(xs);
  const spanY = span(ys);
  const nodes = selected.map((node) => ({
    ...node,
    x: spanX < 1 ? 50 : 12 + ((node.x - Math.min(...xs)) / spanX) * 76,
    y: spanY < 1 ? 50 : 18 + ((node.y - Math.min(...ys)) / spanY) * 64,
    isEntry: entries.has(node.id),
    isExit: exits.has(node.id),
  }));
  return {
    nodes,
    edges: inside
      .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target })),
    childCount: children.length,
    descendantCount,
    hiddenCount: children.length - selected.length,
  };
}

function descendantCountOf(graph: FlowGraph, nodeId: string): number {
  const found = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodes) {
      if (node.parentId && found.has(node.parentId) && !found.has(node.id)) {
        found.add(node.id);
        changed = true;
      }
    }
  }
  return found.size - 1;
}

export function validateScopeExpansion(current: FlowGraph, expanded: FlowGraph, scopeNodeId: string): FlowGraph {
  if (!current.nodes.some((node) => node.id === scopeNodeId)) throw new Error("Expansion scope does not exist");
  const expandedById = new Map(expanded.nodes.map((node) => [node.id, node]));
  for (const node of current.nodes) {
    const candidate = expandedById.get(node.id);
    if (!candidate || JSON.stringify(candidate) !== JSON.stringify(node)) {
      throw new Error(`Expansion changed existing node: ${node.id}`);
    }
  }
  for (const edge of current.edges) {
    if (!expanded.edges.some((candidate) => JSON.stringify(candidate) === JSON.stringify(edge))) {
      throw new Error(`Expansion removed or changed an existing edge: ${edge.source} -> ${edge.target}`);
    }
  }
  const currentIds = new Set(current.nodes.map((node) => node.id));
  const newNodes = expanded.nodes.filter((node) => !currentIds.has(node.id));
  const newIds = new Set(newNodes.map((node) => node.id));
  if (!newNodes.some((node) => node.parentId === scopeNodeId)) throw new Error("Expansion did not add a direct child to the Room");
  for (const node of newNodes) {
    let parentId = node.parentId;
    const visited = new Set([node.id]);
    while (parentId && !currentIds.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = expandedById.get(parentId)?.parentId ?? null;
    }
    if (parentId !== scopeNodeId) throw new Error(`Expansion added a node outside the requested Room: ${node.id}`);
  }
  for (const edge of expanded.edges) {
    const alreadyExisted = current.edges.some((candidate) => JSON.stringify(candidate) === JSON.stringify(edge));
    if (alreadyExisted) continue;
    if (!newIds.has(edge.source) && !newIds.has(edge.target)) {
      throw new Error(`Expansion added an unrelated edge between existing nodes: ${edge.source} -> ${edge.target}`);
    }
  }
  return expanded;
}

export function applyScopeExpansion(current: FlowGraph, expansion: FlowGraphExpansion, scopeNodeId: string): FlowGraph {
  if (!current.nodes.some((node) => node.id === scopeNodeId)) throw new Error("Expansion scope does not exist");
  const currentIds = new Set(current.nodes.map((node) => node.id));
  const newIds = new Set<string>();
  for (const node of expansion.nodes) {
    if (currentIds.has(node.id) || newIds.has(node.id)) throw new Error(`Expansion reused an existing node id: ${node.id}`);
    newIds.add(node.id);
  }
  const allById = new Map([...current.nodes, ...expansion.nodes].map((node) => [node.id, node]));
  if (!expansion.nodes.some((node) => node.parentId === scopeNodeId)) throw new Error("Expansion did not add a direct child to the Room");
  for (const node of expansion.nodes) {
    let parentId = node.parentId;
    const visited = new Set([node.id]);
    while (parentId && newIds.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      parentId = allById.get(parentId)?.parentId ?? null;
    }
    if (parentId !== scopeNodeId) throw new Error(`Expansion added a node outside the requested Room: ${node.id}`);
  }
  const allIds = new Set(allById.keys());
  for (const edge of expansion.edges) {
    if (!allIds.has(edge.source) || !allIds.has(edge.target)) throw new Error(`Expansion edge references an unknown node: ${edge.source} -> ${edge.target}`);
    if (edge.source === edge.target) throw new Error(`Expansion created a self edge: ${edge.source}`);
    if (!newIds.has(edge.source) && !newIds.has(edge.target)) throw new Error(`Expansion added an unrelated edge between existing nodes: ${edge.source} -> ${edge.target}`);
  }
  const existingEdgeKeys = new Set(current.edges.map(edgeKey));
  const newEdges = expansion.edges.filter((edge) => !existingEdgeKeys.has(edgeKey(edge)));
  return parseFlowGraph({ ...current, nodes: [...current.nodes, ...expansion.nodes], edges: [...current.edges, ...newEdges] });
}

function edgeKey(edge: FlowEdge): string {
  return `${edge.source}\u0000${edge.target}\u0000${edge.label}`;
}

function uniqueNodeId(base: string, used: Set<string>): string {
  const normalized = base.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "continued-flow";
  if (!used.has(normalized)) return normalized;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${normalized.slice(0, 39 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Could not allocate a FlowFold continuation Room id");
}

function unfenceJson(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
}

/**
 * Projects a scope while allowing designated Room nodes to be expanded inline.
 */
export function projectFlowWithExpandedScopes(
  graph: FlowGraph,
  scopeId: string | null,
  expandedScopeIds: Set<string> = new Set()
): ScopeProjection {
  const directNodes = graph.nodes.filter((node) => node.parentId === scopeId);
  const expandedChildren: FlowNode[] = [];

  for (const node of directNodes) {
    if (node.kind === "room" && expandedScopeIds.has(node.id)) {
      const children = graph.nodes.filter((child) => child.parentId === node.id);
      expandedChildren.push(...children);
    }
  }

  const allVisibleNodes = [...directNodes, ...expandedChildren];
  const visibleIdSet = new Set(allVisibleNodes.map((n) => n.id));

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const resolveTarget = (nodeId: string): string | null => {
    if (visibleIdSet.has(nodeId)) return nodeId;
    let cursor = byId.get(nodeId);
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor.id)) {
      if (visibleIdSet.has(cursor.id)) return cursor.id;
      visited.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return null;
  };

  const projected = new Map<string, ProjectedFlowEdge>();
  for (const edge of graph.edges) {
    const source = resolveTarget(edge.source);
    const target = resolveTarget(edge.target);
    if (source === target) continue;
    if (source === null && target === null) continue;

    const key = `${source ?? "outside"}\u0000${target ?? "outside"}`;
    const current = projected.get(key);
    if (current) {
      current.count += 1;
      if (edge.label && !current.labels.includes(edge.label)) current.labels.push(edge.label);
      continue;
    }
    projected.set(key, {
      source,
      target,
      sourceOutsideId: source === null ? edge.source : null,
      targetOutsideId: target === null ? edge.target : null,
      labels: edge.label ? [edge.label] : [],
      count: 1,
    });
  }

  return { nodes: allVisibleNodes, edges: [...projected.values()] };
}

/**
 * Computes bounding frame boxes for all inline-expanded Room nodes.
 */
export function getExpandedRoomFrames(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  expandedScopeIds: Set<string> = new Set(),
  edges: FlowEdge[] = [],
  savedLayout: GraphLayout = {}
): ExpandedRoomFrame[] {
  const directNodes = visibleNodes.filter((n) => n.parentId === scopeId);
  const directPositions = layoutNodesWithAreaDSL(directNodes, scopeId, defaultRoomLayoutRules, edges);
  const directPosMap = new Map(directPositions.map((n) => [n.id, n]));

  const frames: ExpandedRoomFrame[] = [];

  for (const node of directNodes) {
    if (node.kind === "room" && expandedScopeIds.has(node.id)) {
      const childNodes = visibleNodes.filter((c) => c.parentId === node.id);
      const saved = savedLayout[node.id];
      const pos = saved ?? directPosMap.get(node.id) ?? { x: 50, y: 50 };

      // Determine frame dimensions
      const isMultiLane = childNodes.length > 3;
      const frameWidth = isMultiLane ? 32.0 : 20.0;
      const maxRows = isMultiLane ? Math.ceil(childNodes.length / 2) : childNodes.length;
      const frameHeight = Math.max(22.0, 7.0 + maxRows * 6.5);

      frames.push({
        roomId: node.id,
        title: node.title,
        bounds: {
          x: +(Math.max(1, pos.x - frameWidth / 2)).toFixed(1),
          y: +(Math.max(2, pos.y - frameHeight / 2)).toFixed(1),
          width: frameWidth,
          height: frameHeight,
        },
        childCount: childNodes.length,
      });
    }
  }

  return frames;
}

/**
 * Computes positions for all visible nodes using compact local frame projections for inline-expanded scopes.
 */
export function layoutFlowNodesWithExpandedScopes(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  expandedScopeIds: Set<string> = new Set(),
  edges: FlowEdge[] = [],
  savedLayout: GraphLayout = {}
): PositionedFlowNode[] {
  const directNodes = visibleNodes.filter((n) => n.parentId === scopeId);
  const directPositions = layoutNodesWithAreaDSL(directNodes, scopeId, defaultRoomLayoutRules, edges);
  const directPosMap = new Map(directPositions.map((n) => [n.id, n]));

  const frames = getExpandedRoomFrames(visibleNodes, scopeId, expandedScopeIds, edges, savedLayout);
  const frameMap = new Map(frames.map((f) => [f.roomId, f]));

  const result: PositionedFlowNode[] = [];

  // 1. Position direct scope nodes
  for (const node of directNodes) {
    const saved = savedLayout[node.id];
    const pos = saved ?? directPosMap.get(node.id) ?? { x: 50, y: 50 };

    if (node.kind === "room" && expandedScopeIds.has(node.id)) {
      const frame = frameMap.get(node.id)!;
      // Position the room node header at the top of the frame
      result.push({
        ...node,
        x: +(frame.bounds.x + frame.bounds.width / 2).toFixed(1),
        y: +(frame.bounds.y + 3.8).toFixed(1),
      });

      // 2. Position child nodes inside the room frame using local area DSL
      const childNodes = visibleNodes.filter((c) => c.parentId === node.id);
      if (childNodes.length > 0) {
        const localRelPositions = layoutNodesWithAreaDSL(childNodes, node.id, defaultRoomLayoutRules, edges);
        const padTop = 8.0;
        const padBottom = 2.5;
        const padLeft = 4.0;
        const padRight = 4.0;
        const innerW = frame.bounds.width - padLeft - padRight;
        const innerH = frame.bounds.height - padTop - padBottom;

        for (const child of localRelPositions) {
          const childX = +(frame.bounds.x + padLeft + (child.x * innerW) / 100).toFixed(1);
          const childY = +(frame.bounds.y + padTop + (child.y * innerH) / 100).toFixed(1);
          result.push({ ...child, x: childX, y: childY });
        }
      }
    } else {
      result.push({ ...node, x: pos.x, y: pos.y });
    }
  }

  return result;
}
