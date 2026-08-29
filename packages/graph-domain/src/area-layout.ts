import type { FlowEdge, FlowNode, FlowNodeKind, PositionedFlowNode } from "./index.js";

export type AreaDirection = "row" | "column" | "grid";

export interface LayoutBounds {
  x: number;      // 0-100 percentage
  y: number;      // 0-100 percentage
  width: number;  // 0-100 percentage
  height: number; // 0-100 percentage
}

export interface AreaMatchRule {
  kinds?: FlowNodeKind[];
  technologies?: string[];
  tags?: string[];
  pattern?: string | RegExp;
  nodeIds?: string[];
}

export interface AreaDefinition {
  id: string;
  name?: string;
  direction?: AreaDirection;
  splitRatio?: number[]; // e.g. [30, 40, 30]
  bounds?: Partial<LayoutBounds>;
  match?: AreaMatchRule;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  gap?: number;
  subAreas?: AreaDefinition[];
}

export interface RoomLayoutRule {
  roomId: string | null;
  area: AreaDefinition;
}

export interface ResolvedArea {
  definition: AreaDefinition;
  bounds: LayoutBounds;
  isLeaf: boolean;
  assignedNodes: FlowNode[];
  fittedBounds?: LayoutBounds;
}

export interface DebugAreaBox {
  id: string;
  name: string;
  bounds: LayoutBounds;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  nodeCount: number;
}

/**
 * Built-in standard architectural DSL layout rules.
 */
export const defaultRoomLayoutRules: RoomLayoutRule[] = [
  // 1. Root Level 3-Tier Architecture Pipeline
  {
    roomId: null,
    area: {
      id: "root-canvas",
      name: "System Root Scope",
      direction: "row",
      splitRatio: [26, 36, 38],
      padding: { top: 6, right: 6, bottom: 6, left: 6 },
      subAreas: [
        // Left Column: Ingress / Frontend / Gateway
        {
          id: "tier-ingress",
          name: "Ingress & Client Layer",
          direction: "column",
          match: {
            nodeIds: ["frontend-portal", "api-gateway"],
            tags: ["frontend", "react", "gateway", "ingress", "client", "spa"],
            kinds: ["ui"],
          },
        },
        // Center Column: Core Coordination & Services
        {
          id: "tier-core",
          name: "Services & Coordination Layer",
          direction: "column",
          match: {
            nodeIds: ["auth-guard", "workflow-engine"],
            tags: ["security", "guard", "engine", "orchestration", "service", "docker"],
            kinds: ["auth", "service", "decision", "process"],
          },
        },
        // Right Column: Persistence & External Cloud
        {
          id: "tier-state-cloud",
          name: "Infrastructure Layer",
          direction: "column",
          splitRatio: [44, 56],
          subAreas: [
            {
              id: "tier-data-queue",
              name: "Persistence & Buffering",
              direction: "row",
              match: {
                nodeIds: ["event-bus", "primary-db"],
                tags: ["postgres", "redis", "acid", "pubsub"],
                kinds: ["database", "queue", "data"],
              },
            },
            {
              id: "tier-cloud-ai",
              name: "External Cloud & AI",
              direction: "grid",
              match: {
                nodeIds: ["ai-synthesizer", "cloud-storage", "payment-hub", "analytics-lake"],
                tags: ["openai", "aws", "stripe", "gcp", "azure"],
                kinds: ["external"],
              },
            },
          ],
        },
      ],
    },
  },

  // 2. API Gateway Room: Left Vertical Core REST Column + Right Async/Stream/GraphQL Column
  {
    roomId: "api-gateway",
    area: {
      id: "gateway-canvas",
      name: "API Gateway Scope",
      direction: "row",
      splitRatio: [48, 52],
      padding: { top: 6, right: 6, bottom: 6, left: 6 },
      subAreas: [
        // Left Column: Core REST Endpoints stacked vertically
        {
          id: "gw-rest-endpoints",
          name: "Core REST Endpoints Lane",
          direction: "column",
          match: {
            nodeIds: [
              "api-auth-login",
              "api-workflows-create",
              "api-workflows-get",
              "api-workflows-run",
            ],
            tags: ["auth", "workflow", "read", "create", "execute", "login"],
            pattern: /auth|login|workflows/i,
          },
        },
        // Right Column: AI Streaming, Webhooks & GraphQL (Vertical Stack)
        {
          id: "gw-async-endpoints",
          name: "Async / SSE / Webhook Lane",
          direction: "column",
          match: {
            nodeIds: ["api-ai-synthesize", "api-stripe-webhook", "api-graphql"],
            tags: ["openai", "stream", "webhook", "stripe", "graphql", "federation"],
            pattern: /ai|synthesize|webhook|stripe|graphql/i,
          },
        },
      ],
    },
  },

  // 3. Workflow Engine Room: Horizontal Pipeline
  {
    roomId: "workflow-engine",
    area: {
      id: "engine-canvas",
      name: "Workflow Engine Scope",
      direction: "row",
      splitRatio: [26, 48, 26],
      padding: { top: 8, right: 6, bottom: 8, left: 6 },
      subAreas: [
        {
          id: "engine-ingress",
          name: "Dispatcher Ingress",
          direction: "column",
          match: { nodeIds: ["dispatch-service"], tags: ["dispatcher", "ingress"] },
        },
        {
          id: "engine-execution",
          name: "Execution & Branching",
          direction: "row",
          match: {
            nodeIds: ["branch-evaluator", "k8s-runner"],
            tags: ["decision", "branching", "k8s", "containers"],
          },
        },
        {
          id: "engine-state",
          name: "State Checkpoint",
          direction: "column",
          match: { nodeIds: ["state-checkpoint"], tags: ["checkpoint", "wal"] },
        },
      ],
    },
  },

  // 4. Frontend Portal Room: 2-Column Grid
  {
    roomId: "frontend-portal",
    area: {
      id: "frontend-canvas",
      name: "Frontend Portal Scope",
      direction: "row",
      splitRatio: [50, 50],
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      subAreas: [
        {
          id: "ui-web-lane",
          name: "Web Apps & Editors",
          direction: "column",
          match: { nodeIds: ["web-dashboard", "canvas-editor"], tags: ["dashboard", "canvas"] },
        },
        {
          id: "ui-aux-lane",
          name: "Mobile & Security Views",
          direction: "column",
          match: { nodeIds: ["mobile-client", "auth-modal"], tags: ["mobile", "modal"] },
        },
      ],
    },
  },
];

/**
 * Generates deterministic pleasing pastel debug colors for an area ID.
 */
function getAreaColor(id: string): { bg: string; border: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsla(${hue}, 65%, 45%, 0.14)`,
    border: `hsla(${hue}, 80%, 65%, 0.7)`,
    text: `hsla(${hue}, 90%, 82%, 0.95)`,
  };
}

/**
 * Calculates specificity score for how well a node matches an area's rule.
 */
function calculateMatchScore(node: FlowNode, match?: AreaMatchRule): number {
  if (!match) return 0;
  let score = 0;

  if (match.nodeIds && match.nodeIds.includes(node.id)) {
    score += 100;
  }

  if (match.pattern) {
    const regex = typeof match.pattern === "string" ? new RegExp(match.pattern, "i") : match.pattern;
    if (regex.test(node.id) || regex.test(node.title) || regex.test(node.summary)) {
      score += 50;
    }
  }

  if (match.tags && node.tags) {
    const nodeTags = node.tags.map((t) => t.toLowerCase());
    const matchedTagCount = match.tags.filter((t) => nodeTags.includes(t.toLowerCase())).length;
    score += matchedTagCount * 20;
  }

  if (match.technologies && node.technology) {
    const tech = node.technology.toLowerCase();
    if (match.technologies.some((t) => t.toLowerCase() === tech)) {
      score += 15;
    }
  }

  if (match.kinds && match.kinds.includes(node.kind)) {
    score += 10;
  }

  return score;
}

/**
 * Recursively resolves area bounding boxes.
 */
function resolveAreaTree(
  area: AreaDefinition,
  parentBounds: LayoutBounds
): ResolvedArea[] {
  const padTop = area.padding?.top ?? 0;
  const padRight = area.padding?.right ?? 0;
  const padBottom = area.padding?.bottom ?? 0;
  const padLeft = area.padding?.left ?? 0;

  const currentBounds: LayoutBounds = {
    x: +(parentBounds.x + padLeft).toFixed(1),
    y: +(parentBounds.y + padTop).toFixed(1),
    width: +(Math.max(5, parentBounds.width - padLeft - padRight)).toFixed(1),
    height: +(Math.max(5, parentBounds.height - padTop - padBottom)).toFixed(1),
  };

  const isLeaf = !area.subAreas || area.subAreas.length === 0;
  const resolved: ResolvedArea = {
    definition: area,
    bounds: currentBounds,
    isLeaf,
    assignedNodes: [],
  };

  if (isLeaf) {
    return [resolved];
  }

  const subAreas = area.subAreas!;
  const count = subAreas.length;
  const ratios =
    area.splitRatio && area.splitRatio.length === count
      ? area.splitRatio
      : new Array(count).fill(100 / count);
  const totalRatio = ratios.reduce((sum, r) => sum + r, 0);

  const direction = area.direction ?? "row";
  const leafAreas: ResolvedArea[] = [];

  let accumulated = 0;
  for (let i = 0; i < count; i++) {
    const subDef = subAreas[i]!;
    const proportion = ratios[i]! / totalRatio;

    let subBounds: LayoutBounds;
    if (direction === "row") {
      // Split horizontally
      const subWidth = +(currentBounds.width * proportion).toFixed(1);
      const subX = +(currentBounds.x + accumulated).toFixed(1);
      accumulated += subWidth;
      subBounds = {
        x: subX,
        y: currentBounds.y,
        width: subWidth,
        height: currentBounds.height,
      };
    } else {
      // Split vertically
      const subHeight = +(currentBounds.height * proportion).toFixed(1);
      const subY = +(currentBounds.y + accumulated).toFixed(1);
      accumulated += subHeight;
      subBounds = {
        x: currentBounds.x,
        y: subY,
        width: currentBounds.width,
        height: subHeight,
      };
    }

    const subResolved = resolveAreaTree(subDef, subBounds);
    leafAreas.push(...subResolved);
  }

  return leafAreas;
}

/**
 * Returns content-fitted debug bounding boxes with colors for a given Room scope.
 */
export function getDebugAreasForScope(
  roomId: string | null = null,
  nodes: FlowNode[] = [],
  rules: RoomLayoutRule[] = defaultRoomLayoutRules
): DebugAreaBox[] {
  const matchedRule =
    rules.find((r) => r.roomId === roomId) ??
    rules.find((r) => r.roomId === null) ??
    defaultRoomLayoutRules[0]!;

  const initialBounds: LayoutBounds = { x: 0, y: 0, width: 100, height: 100 };
  const leafAreas = resolveAreaTree(matchedRule.area, initialBounds);

  // Assign nodes to calculate fitted bounds
  for (const node of nodes) {
    let bestArea: ResolvedArea | null = null;
    let highestScore = 0;
    for (const area of leafAreas) {
      const score = calculateMatchScore(node, area.definition.match);
      if (score > highestScore) {
        highestScore = score;
        bestArea = area;
      }
    }
    if (bestArea && highestScore > 0) {
      bestArea.assignedNodes.push(node);
    }
  }

  // Also compute positioned coordinates to get tight fitted bounds
  const positioned = layoutNodesWithAreaDSL(nodes, roomId, rules);
  const posMap = new Map(positioned.map((n) => [n.id, n]));

  return leafAreas
    .filter((area) => area.assignedNodes.length > 0 || nodes.length === 0)
    .map((area) => {
      const colors = getAreaColor(area.definition.id);
      const areaNodePositions = area.assignedNodes
        .map((n) => posMap.get(n.id))
        .filter((p): p is PositionedFlowNode => p !== undefined);

      let bounds = area.bounds;
      if (areaNodePositions.length > 0) {
        const xs = areaNodePositions.map((p) => p.x);
        const ys = areaNodePositions.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // Ultra-tight Content-Fit with 4.8% horizontal and 5.0% vertical padding
        const padX = 4.8;
        const padY = 5.0;
        const fitX = +(Math.max(1, minX - padX)).toFixed(1);
        const fitY = +(Math.max(1, minY - padY)).toFixed(1);
        const fitW = +(Math.max(10, maxX - minX + padX * 2)).toFixed(1);
        const fitH = +(Math.max(10, maxY - minY + padY * 2)).toFixed(1);

        bounds = {
          x: fitX,
          y: fitY,
          width: fitW,
          height: fitH,
        };
      }

      return {
        id: area.definition.id,
        name: area.definition.name ?? area.definition.id,
        bounds,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        nodeCount: area.assignedNodes.length,
      };
    });
}

/**
 * Computes dense, well-spaced positions for nodes using Recursive Area Layout DSL.
 */
export function layoutNodesWithAreaDSL(
  nodes: FlowNode[],
  roomId: string | null = null,
  rules: RoomLayoutRule[] = defaultRoomLayoutRules,
  edges: FlowEdge[] = []
): PositionedFlowNode[] {
  if (nodes.length === 0) return [];

  // If simple generic nodes with edges and no explicit room rule, fallback to topological layout
  const hasSpecificRoomRule = rules.some((r) => r.roomId === roomId && roomId !== null);
  const hasDomainKinds = nodes.some((n) =>
    ["api", "database", "queue", "auth", "external", "ui"].includes(n.kind)
  );

  if (!hasSpecificRoomRule && !hasDomainKinds && edges.length > 0) {
    return topologicalFallbackLayout(nodes, edges);
  }

  // Find matching rule for this roomId or fallback to root rule
  const matchedRule =
    rules.find((r) => r.roomId === roomId) ??
    rules.find((r) => r.roomId === null) ??
    defaultRoomLayoutRules[0]!;

  const initialBounds: LayoutBounds = { x: 0, y: 0, width: 100, height: 100 };
  const leafAreas = resolveAreaTree(matchedRule.area, initialBounds);

  const unassignedNodes: FlowNode[] = [];

  // 1. Assign nodes to leaf area with the highest match score
  for (const node of nodes) {
    let bestArea: ResolvedArea | null = null;
    let highestScore = 0;

    for (const area of leafAreas) {
      const score = calculateMatchScore(node, area.definition.match);
      if (score > highestScore) {
        highestScore = score;
        bestArea = area;
      }
    }

    if (bestArea && highestScore > 0) {
      bestArea.assignedNodes.push(node);
    } else {
      unassignedNodes.push(node);
    }
  }

  // 2. If any nodes were not matched, distribute them to least occupied leaf area
  if (unassignedNodes.length > 0) {
    const defaultArea =
      leafAreas.find((a) => a.definition.id.includes("core") || a.definition.id.includes("rest")) ??
      leafAreas[0]!;
    for (const node of unassignedNodes) {
      defaultArea.assignedNodes.push(node);
    }
  }

  // 3. Compute final compact (x, y) coordinates for nodes inside each leaf area
  const result: PositionedFlowNode[] = [];

  for (const area of leafAreas) {
    const areaNodes = area.assignedNodes;
    if (areaNodes.length === 0) continue;

    const { x: ax, y: ay, width: aw, height: ah } = area.bounds;
    const dir = area.definition.direction ?? "column";

    if (dir === "column") {
      // Tight vertical stack with controlled 11.5% pitch
      const centerX = +(ax + aw / 2).toFixed(1);
      const n = areaNodes.length;
      const pitchY = 11.5;
      const totalSpanY = Math.min(ah * 0.90, (n - 1) * pitchY);
      const startY = +(ay + (ah - totalSpanY) / 2).toFixed(1);

      areaNodes.forEach((node, idx) => {
        const y =
          n === 1
            ? +(ay + ah / 2).toFixed(1)
            : +(startY + (totalSpanY * idx) / (n - 1)).toFixed(1);
        result.push({ ...node, x: centerX, y });
      });
    } else if (dir === "row") {
      // Tight horizontal row with controlled 14.0% pitch
      const centerY = +(ay + ah / 2).toFixed(1);
      const n = areaNodes.length;
      const pitchX = 14.0;
      const totalSpanX = Math.min(aw * 0.90, (n - 1) * pitchX);
      const startX = +(ax + (aw - totalSpanX) / 2).toFixed(1);

      areaNodes.forEach((node, idx) => {
        const x =
          n === 1
            ? +(ax + aw / 2).toFixed(1)
            : +(startX + (totalSpanX * idx) / (n - 1)).toFixed(1);
        result.push({ ...node, x, y: centerY });
      });
    } else {
      // Tight grid with controlled 13.5% X pitch and 11.5% Y pitch
      const cols = Math.ceil(Math.sqrt(areaNodes.length));
      const rows = Math.ceil(areaNodes.length / cols);
      const pitchX = 13.5;
      const pitchY = 11.5;
      const spanX = Math.min(aw * 0.90, (cols - 1) * pitchX);
      const spanY = Math.min(ah * 0.90, (rows - 1) * pitchY);
      const startX = +(ax + (aw - spanX) / 2).toFixed(1);
      const startY = +(ay + (ah - spanY) / 2).toFixed(1);

      areaNodes.forEach((node, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x =
          cols === 1 ? +(ax + aw / 2).toFixed(1) : +(startX + (spanX * col) / (cols - 1)).toFixed(1);
        const y =
          rows === 1 ? +(ay + ah / 2).toFixed(1) : +(startY + (spanY * row) / (rows - 1)).toFixed(1);
        result.push({ ...node, x, y });
      });
    }
  }

  return result;
}

/**
 * Standard topological fallback for generic graphs without domain kinds.
 */
function topologicalFallbackLayout(visible: FlowNode[], edges: FlowEdge[]): PositionedFlowNode[] {
  const ids = new Set(visible.map((node) => node.id));
  const order = new Map(visible.map((node, index) => [node.id, index]));
  const outgoing = new Map(visible.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(visible.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue;
    if (outgoing.get(edge.source)!.includes(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
  }

  const ranks = new Map(visible.map((node) => [node.id, 0]));
  const queue = visible.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const visited = new Set<string>();
  while (queue.length) {
    queue.sort((left, right) => order.get(left)! - order.get(right)!);
    const source = queue.shift()!;
    visited.add(source);
    for (const target of outgoing.get(source)!) {
      ranks.set(target, Math.max(ranks.get(target)!, ranks.get(source)! + 1));
      indegree.set(target, indegree.get(target)! - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }

  const highestRank = Math.max(0, ...ranks.values());
  visible.filter((node) => !visited.has(node.id)).forEach((node, index) => {
    ranks.set(node.id, highestRank + Math.floor(index / 3) + (visited.size ? 1 : 0));
  });

  const groups = new Map<number, FlowNode[]>();
  for (const node of visible) {
    const rank = ranks.get(node.id)!;
    const group = groups.get(rank) ?? [];
    group.push(node);
    groups.set(rank, group);
  }
  const orderedRanks = [...groups.keys()].sort((left, right) => left - right);
  const rankIndex = new Map(orderedRanks.map((rank, index) => [rank, index]));
  const result = new Map<string, PositionedFlowNode>();
  for (const [rank, groupNodes] of groups) {
    const column = rankIndex.get(rank)!;
    const x = orderedRanks.length === 1 ? 50 : 15 + (70 * column) / (orderedRanks.length - 1);
    groupNodes.forEach((node, row) => {
      const y = groupNodes.length === 1 ? 50 : 20 + (60 * row) / (groupNodes.length - 1);
      result.set(node.id, { ...node, x, y });
    });
  }
  return visible.map((node) => result.get(node.id)!);
}
