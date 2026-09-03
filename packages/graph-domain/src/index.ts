import { z } from "zod";
import { isExpandedRoom } from "./room.js";
import { toProviderJsonSchema } from "./json-schema.js";
import {
  DEFAULT_STAGE,
  nodeExtent,
  type LayoutView,
  type NodeExtent,
  MAX_ROOM_FRAME_SHARE,
  PORTAL_CARD_HEIGHT,
  PORTAL_CARD_WIDTH,
  NESTED_CARD_HEIGHT,
  NESTED_CARD_WIDTH,
  ROOM_FRAME_PADDING,
  ROOM_HEADER_HEIGHT,
  roomFramePixelSize,
  type RoomFrameMetrics,
} from "./layout-metrics.js";
import {
  compileSemanticLayoutPlan,
  defaultRoomLayoutRules,
  deriveSemanticLayoutPlan,
  layoutNodesWithAreaDSL,
  type ExpandedRoomFrame,
  type LayoutBounds,
  type RoomLayoutRule,
} from "./area-layout.js";

export * from "./area-layout.js";
export * from "./room.js";
export * from "./layout-metrics.js";

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

export const implementationStepKindSchema = z.enum([
  "phase",
  "condition",
  "call",
  "side-effect",
  "return",
]);

export const sourceReferenceSchema = z.object({
  path: z.string().trim().min(1).max(240),
  symbol: z.string().trim().min(1).max(120).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
}).refine(
  (source) => source.startLine === undefined || source.endLine === undefined || source.endLine >= source.startLine,
  { path: ["endLine"], message: "endLine must not be before startLine" }
);

const implementationStepShape = {
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  title: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(180),
  kind: implementationStepKindSchema,
  inputs: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  outputs: z.array(z.string().trim().min(1).max(80)).max(4).optional(),
  source: sourceReferenceSchema.optional(),
};

// Provider JSON schemas are deliberately reference-free, so the authored tree
// has a bounded three-level shape instead of a recursive schema: outline,
// phases, then their meaningful substeps. That is also enough depth for an
// explanation UI; a raw AST would only move the unreadable code into a tree.
export const implementationLeafSchema = z.object(implementationStepShape);
export const implementationStepSchema = z.object({
  ...implementationStepShape,
  children: z.array(implementationLeafSchema).max(5).optional(),
});
export const implementationOutlineSchema = z.object({
  entrypoint: z.string().trim().min(1).max(120),
  source: sourceReferenceSchema,
  steps: z.array(implementationStepSchema).min(1).max(6),
}).superRefine((outline, context) => {
  const seen = new Set<string>();
  for (const [stepIndex, step] of outline.steps.entries()) {
    if (seen.has(step.id)) {
      context.addIssue({
        code: "custom",
        path: ["steps", stepIndex, "id"],
        message: `Duplicate implementation step id: ${step.id}`,
      });
    }
    seen.add(step.id);
    for (const [childIndex, child] of (step.children ?? []).entries()) {
      if (seen.has(child.id)) {
        context.addIssue({
          code: "custom",
          path: ["steps", stepIndex, "children", childIndex, "id"],
          message: `Duplicate implementation step id: ${child.id}`,
        });
      }
      seen.add(child.id);
    }
  }
});

export type ImplementationStepKind = z.infer<typeof implementationStepKindSchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type ImplementationLeaf = z.infer<typeof implementationLeafSchema>;
export type ImplementationStep = z.infer<typeof implementationStepSchema>;
export type ImplementationOutline = z.infer<typeof implementationOutlineSchema>;

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
  implementation: implementationOutlineSchema.optional(),
});
export type FlowNodeStatus = z.infer<typeof flowNodeStatusSchema>;

export const flowEdgeSchema = z.object({
  source: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  target: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().max(60),
});

const flowGraphTitleShape = {
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(400),
};

export const flowGraphSchema = z.object({
  ...flowGraphTitleShape,
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
    if (node.implementation) {
      const sources = [
        node.implementation.source,
        ...node.implementation.steps.flatMap((step) => [
          ...(step.source ? [step.source] : []),
          ...(step.children ?? []).flatMap((child) => child.source ? [child.source] : []),
        ]),
      ];
      for (const source of sources) {
        if (!node.evidence.includes(source.path)) {
          context.addIssue({
            code: "custom",
            path: ["nodes", index, "implementation", "source", "path"],
            message: `Implementation source must also appear in evidence: ${source.path}`,
          });
        }
      }
    }
  });
  // A parent cycle keeps every node in it out of every scope: each one is a
  // descendant of the others, so no scope ever claims it and it is drawn
  // nowhere. Each traversal already refuses to loop forever, but the graph is
  // still unreadable, so reject it once here instead of surviving it everywhere.
  const parentOf = new Map(graph.nodes.map((node) => [node.id, node.parentId]));
  graph.nodes.forEach((node, index) => {
    const seen = new Set<string>([node.id]);
    let cursor = node.parentId;
    while (cursor && parentOf.has(cursor)) {
      if (seen.has(cursor)) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "parentId"],
          message: `Parent cycle through: ${cursor}`,
        });
        return;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
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

// The model describes semantic grouping, never coordinates or raw CSS-like
// spacing. The deterministic compiler in area-layout turns this small, safe
// document into the lower-level Area DSL used by every canvas projection.
export const semanticLayoutAreaSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z.string().trim().min(1).max(60),
  direction: z.enum(["row", "column", "grid"]),
  nodeIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,39}$/)).max(7),
});

export const semanticScopeLayoutSchema = z.object({
  roomId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).nullable(),
  direction: z.enum(["row", "column"]),
  areas: z.array(semanticLayoutAreaSchema).min(1).max(4),
});

// A lock is the user's statement about an area, not the model's, so it lives on
// the document rather than inside the plan a provider authors.
export const layoutAreaLockSchema = z.object({
  roomId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).nullable(),
  areaId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
});
export type LayoutAreaLock = z.infer<typeof layoutAreaLockSchema>;

export const semanticLayoutPlanSchema = z.object({
  version: z.literal(1),
  scopes: z.array(semanticScopeLayoutSchema).min(1).max(64),
});

export type SemanticLayoutArea = z.infer<typeof semanticLayoutAreaSchema>;
export type SemanticScopeLayout = z.infer<typeof semanticScopeLayoutSchema>;
export type SemanticLayoutPlan = z.infer<typeof semanticLayoutPlanSchema>;

export const flowGraphGenerationSchema = z.object({
  graph: flowGraphSchema,
  layoutPlan: semanticLayoutPlanSchema,
});
export type FlowGraphGeneration = z.infer<typeof flowGraphGenerationSchema>;

export const flowGraphExpansionSchema = z.object({
  nodes: z.array(flowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
});
export type FlowGraphExpansion = z.infer<typeof flowGraphExpansionSchema>;

export const flowGraphGenerationExpansionSchema = flowGraphExpansionSchema.extend({
  layoutScopes: z.array(semanticScopeLayoutSchema).min(1),
});
export type FlowGraphGenerationExpansion = z.infer<typeof flowGraphGenerationExpansionSchema>;

export const flowNodePositionSchema = z.object({
  x: z.number().min(4).max(96),
  y: z.number().min(4).max(96),
});
export const graphLayoutSchema = z.record(z.string(), flowNodePositionSchema);
export type FlowNodePosition = z.infer<typeof flowNodePositionSchema>;
export type GraphLayout = z.infer<typeof graphLayoutSchema>;

export const generatedFlowGraphSchema = z.object({
  projectId: z.string().uuid(),
  // Which agent produced this document. The domain records the provenance and
  // does not enumerate providers: that list belongs to the layer that runs them.
  provider: z.string().trim().min(1).max(40),
  snapshotHash: z.string().min(1).max(128),
  generatedAt: z.string().min(1).max(64),
  graph: flowGraphSchema,
  layout: graphLayoutSchema,
  layoutOverrides: graphLayoutSchema.optional(),
  layoutPlan: semanticLayoutPlanSchema.optional(),
  // Which build of the layout compiler produced `layout`. Not a literal: a
  // document saved by an older build must still load, so that it can be
  // recognised as stale and recomputed.
  layoutEngineVersion: z.number().int().positive().optional(),
  lockedLayoutAreas: z.array(layoutAreaLockSchema).max(64).optional(),
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

// What the model is allowed to author. `status` and `codeSnippet` are omitted
// on purpose: status is a runtime annotation a static snapshot cannot assert,
// and a code snippet duplicates `evidence` at a large cost in tokens. Both stay
// editable by hand, and both survive a regeneration.
export const generatedFlowNodeSchema = flowNodeSchema.omit({ status: true, codeSnippet: true });

const generatedFlowGraphContentSchema = z.object({
  ...flowGraphTitleShape,
  nodes: z.array(generatedFlowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
});

const generatedFlowGraphPatchSchema = z.object({
  nodes: z.array(generatedFlowNodeSchema).min(1),
  edges: z.array(flowEdgeSchema),
});

// Every schema handed to a provider is derived from the Zod definitions above,
// so a field can never exist in the domain and be missing from what the model
// is asked to produce.
export const FLOW_GRAPH_JSON_SCHEMA = toProviderJsonSchema(generatedFlowGraphContentSchema);

export const SEMANTIC_SCOPE_LAYOUT_JSON_SCHEMA = toProviderJsonSchema(semanticScopeLayoutSchema);

export const SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA = toProviderJsonSchema(semanticLayoutPlanSchema);

export const FLOW_GRAPH_GENERATION_JSON_SCHEMA = toProviderJsonSchema(
  z.object({ graph: generatedFlowGraphContentSchema, layoutPlan: semanticLayoutPlanSchema })
);

export const FLOW_GRAPH_EXPANSION_JSON_SCHEMA = toProviderJsonSchema(generatedFlowGraphPatchSchema);

export const FLOW_GRAPH_GENERATION_EXPANSION_JSON_SCHEMA = toProviderJsonSchema(
  generatedFlowGraphPatchSchema.extend({
    layoutScopes: z.array(semanticScopeLayoutSchema).min(1),
  })
);

export function parseFlowGraph(value: unknown): FlowGraph {
  return flowGraphSchema.parse(value);
}

export function parseFlowGraphGeneration(value: unknown): FlowGraphGeneration {
  return flowGraphGenerationSchema.parse(value);
}

export function parseFlowGraphGenerationText(text: string): FlowGraphGeneration {
  return parseFlowGraphGeneration(JSON.parse(unfenceJson(text)));
}

export function parseSemanticLayoutPlan(value: unknown): SemanticLayoutPlan {
  return semanticLayoutPlanSchema.parse(value);
}

export function parseSemanticLayoutPlanText(text: string): SemanticLayoutPlan {
  return parseSemanticLayoutPlan(JSON.parse(unfenceJson(text)));
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

export function parseFlowGraphGenerationExpansion(value: unknown): FlowGraphGenerationExpansion {
  return flowGraphGenerationExpansionSchema.parse(value);
}

export function parseFlowGraphGenerationExpansionText(text: string): FlowGraphGenerationExpansion {
  return parseFlowGraphGenerationExpansion(JSON.parse(unfenceJson(text)));
}

export function resolveRoomLayoutRules(
  graph: FlowGraph,
  plan?: SemanticLayoutPlan
): RoomLayoutRule[] {
  // A missing plan must not make every nested Room reuse the root architecture
  // rule. That split API endpoints into unrelated root tiers and produced the
  // characteristic tall-left-lane / bottom-right-lane Inside frame. Derive a
  // scope-aware deterministic plan for legacy documents and preview fixtures.
  return compileSemanticLayoutPlan(graph, plan ?? deriveSemanticLayoutPlan(graph));
}

export function layoutRootNodes(
  graph: FlowGraph,
  rules: RoomLayoutRule[] = resolveRoomLayoutRules(graph)
): PositionedFlowNode[] {
  const roots = graph.nodes.filter((node) => node.parentId === null);
  const visible = roots.length > 0 ? roots : graph.nodes;
  return layoutFlowNodes(visible, graph.edges, null, rules);
}

export function layoutFlowNodes(
  visible: FlowNode[],
  edges: FlowEdge[] = [],
  roomId: string | null = null,
  rules: RoomLayoutRule[] = defaultRoomLayoutRules
): PositionedFlowNode[] {
  if (visible.length === 0) return [];
  // Use the Recursive Area Layout DSL
  return layoutNodesWithAreaDSL(visible, roomId, rules, edges);
}

export function createDefaultGraphLayout(
  graph: FlowGraph,
  existing: GraphLayout = {},
  rules: RoomLayoutRule[] = resolveRoomLayoutRules(graph)
): GraphLayout {
  const layout: GraphLayout = { ...existing };
  const parentIds = new Set<string | null>([null, ...graph.nodes.map((node) => node.parentId)]);
  for (const parentId of parentIds) {
    const nodes = graph.nodes.filter((node) => node.parentId === parentId);
    const projection = projectFlowToScope(graph, parentId);
    const projectedEdges = projection.edges
      .filter((edge): edge is ProjectedFlowEdge & { source: string; target: string } => edge.source !== null && edge.target !== null)
      .map((edge) => ({ source: edge.source, target: edge.target, label: edge.labels[0] ?? "" }));
    for (const node of layoutFlowNodes(nodes, projectedEdges, parentId, rules)) {
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

/** How many areas one scope may be split into before the rest are dropped. */
const MAX_AREAS_PER_SCOPE = 4;

/**
 * Carries locked areas from the current plan into an incoming one. A locked area
 * keeps its label, direction and exact membership; the nodes it holds are taken
 * out of every other area of that scope, so a regeneration can rearrange what is
 * left without ever moving what the user pinned.
 */
export function applyLayoutAreaLocks(
  current: SemanticLayoutPlan | undefined,
  incoming: SemanticLayoutPlan,
  locks: readonly LayoutAreaLock[] = []
): SemanticLayoutPlan {
  if (!current || locks.length === 0) return incoming;
  const scopeKey = (roomId: string | null) => roomId ?? "\u0000root";
  const lockedIn = new Map<string, Set<string>>();
  for (const lock of locks) {
    const key = scopeKey(lock.roomId);
    if (!lockedIn.has(key)) lockedIn.set(key, new Set());
    lockedIn.get(key)!.add(lock.areaId);
  }

  const scopes: SemanticScopeLayout[] = [];
  const handled = new Set<string>();
  const scopesToVisit = [
    ...incoming.scopes,
    // A locked scope the model left out entirely still has to survive.
    ...current.scopes.filter(
      (scope) =>
        lockedIn.has(scopeKey(scope.roomId)) &&
        !incoming.scopes.some((other) => other.roomId === scope.roomId)
    ),
  ];

  for (const scope of scopesToVisit) {
    const key = scopeKey(scope.roomId);
    if (handled.has(key)) continue;
    handled.add(key);
    const lockedAreaIds = lockedIn.get(key);
    const currentScope = current.scopes.find((other) => other.roomId === scope.roomId);
    const locked = lockedAreaIds
      ? (currentScope?.areas ?? []).filter((area) => lockedAreaIds.has(area.id))
      : [];
    if (locked.length === 0) {
      scopes.push(scope);
      continue;
    }
    const pinned = new Set(locked.flatMap((area) => area.nodeIds));
    const rearranged = (scope === currentScope ? [] : scope.areas)
      .filter((area) => !locked.some((lockedArea) => lockedArea.id === area.id))
      .map((area) => ({ ...area, nodeIds: area.nodeIds.filter((id) => !pinned.has(id)) }))
      .filter((area) => area.nodeIds.length > 0);
    scopes.push({
      roomId: scope.roomId,
      direction: scope.direction,
      areas: [...locked, ...rearranged].slice(0, MAX_AREAS_PER_SCOPE),
    });
  }

  return { ...incoming, scopes: scopes.length > 0 ? scopes : incoming.scopes };
}

/**
 * A stored coordinate is meaningless without the scope it was captured in: a
 * node inside a Room is stored in that Room's local 0-100 space, everything
 * else in stage percentages, and nothing but the node's `parentId` tells the
 * two apart. So a coordinate must not outlive a re-parenting — and re-parenting
 * is routine, because `balanceFlowGraphScopes` moves overflow nodes into a
 * "Continued flow" Room on every generation.
 */
export function pruneLayoutToGraph(
  layout: GraphLayout,
  previous: FlowGraph | null,
  next: FlowGraph
): GraphLayout {
  const nextParents = new Map(next.nodes.map((node) => [node.id, node.parentId]));
  const previousParents = new Map((previous?.nodes ?? []).map((node) => [node.id, node.parentId]));
  const kept: GraphLayout = {};
  for (const [nodeId, position] of Object.entries(layout)) {
    if (!nextParents.has(nodeId)) continue;
    if (previousParents.has(nodeId) && previousParents.get(nodeId) !== nextParents.get(nodeId)) continue;
    kept[nodeId] = position;
  }
  return kept;
}

/** What a document carries into the next version of itself. */
export type LayoutCarrier = {
  graph: FlowGraph | null;
  layout: GraphLayout;
  layoutOverrides?: GraphLayout;
  layoutPlan?: SemanticLayoutPlan;
  lockedLayoutAreas?: readonly LayoutAreaLock[];
};

export type LayoutSlice = Required<
  Pick<GeneratedFlowGraph, "graph" | "layout" | "layoutOverrides" | "layoutPlan" | "layoutEngineVersion">
>;

/**
 * The only way a new graph or a new plan may enter a document. Everything that
 * has to happen together lives here — locks are carried, coordinates that no
 * longer mean what they did are dropped, the rest is compiled from the merged
 * plan — so no call site can perform half of it.
 *
 * `carryGeneratedCoordinates` is the difference between growing a graph and
 * replacing it. An expansion rewrites the plan of one scope, so every other
 * scope should stay exactly where it was. A full regeneration brings a plan for
 * the whole graph, and keeping the old coordinates would leave a document whose
 * positions contradict its own plan.
 */
export function withGraphAndPlan(
  previous: LayoutCarrier,
  graph: FlowGraph,
  layoutPlan: SemanticLayoutPlan,
  options: { carryGeneratedCoordinates?: boolean } = {}
): LayoutSlice {
  const merged = applyLayoutAreaLocks(previous.layoutPlan, layoutPlan, previous.lockedLayoutAreas);
  const rules = resolveRoomLayoutRules(graph, merged);
  const carried = options.carryGeneratedCoordinates
    ? pruneLayoutToGraph(previous.layout, previous.graph, graph)
    : {};
  return {
    graph,
    layoutPlan: merged,
    layout: createDefaultGraphLayout(graph, carried, rules),
    layoutOverrides: pruneLayoutToGraph(previous.layoutOverrides ?? {}, previous.graph, graph),
    layoutEngineVersion: LAYOUT_ENGINE_VERSION,
  };
}

/**
 * Swaps in a newly generated layout plan without touching the graph. Generated
 * coordinates are rebuilt from the merged plan; `layoutOverrides` is the user's
 * own work, and a relayout never discards it.
 */
export function withLayoutPlan(
  document: GeneratedFlowGraph,
  layoutPlan: SemanticLayoutPlan
): GeneratedFlowGraph {
  return { ...document, ...withGraphAndPlan(document, document.graph, layoutPlan) };
}

/**
 * The build of the layout compiler that produced a document's coordinates. Bump
 * it whenever a change to the compiler would place existing nodes differently.
 */
export const LAYOUT_ENGINE_VERSION = 4;

/**
 * Coordinates from an older compiler are not comparable with the current one,
 * so they are recomputed from the plan. Positions the user dragged by hand live
 * in `layoutOverrides` and always survive.
 */
export function withCurrentLayoutEngine(document: GeneratedFlowGraph): GeneratedFlowGraph {
  if (document.layoutEngineVersion === LAYOUT_ENGINE_VERSION) return document;
  const rules = resolveRoomLayoutRules(document.graph, document.layoutPlan);
  return {
    ...document,
    layout: createDefaultGraphLayout(document.graph, {}, rules),
    layoutEngineVersion: LAYOUT_ENGINE_VERSION,
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
export function buildPortalPreview(
  graph: FlowGraph,
  nodeId: string,
  limit = PORTAL_PREVIEW_MAX_NODES,
  rules: RoomLayoutRule[] = resolveRoomLayoutRules(graph)
): PortalPreview {
  const children = graph.nodes.filter((node) => node.parentId === nodeId);
  const descendantCount = descendantCountOf(graph, nodeId);
  if (children.length === 0) {
    return { nodes: [], edges: [], childCount: 0, descendantCount, hiddenCount: 0 };
  }
  const projection = projectFlowToScope(graph, nodeId);
  const inside = projection.edges.filter(
    (edge): edge is ProjectedFlowEdge & { source: string; target: string } => edge.source !== null && edge.target !== null,
  );
  const positioned = layoutFlowNodes(
    children,
    inside.map((edge) => ({ source: edge.source, target: edge.target, label: "" })),
    nodeId,
    rules
  );
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
    if (isExpandedRoom(node, expandedScopeIds)) {
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
/** How many lanes and rows an unfolded Room's own layout puts its children in. */
export type RoomGridShape = { roomId: string; columns: number; rows: number };

/**
 * The shape of every unfolded Room, in cards rather than pixels or percentages.
 * The stage is sized from this, and the frames are then sized against that
 * stage — so nothing here may depend on the stage.
 */
export function getExpandedRoomShapes(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  expandedScopeIds: Set<string> = new Set(),
  edges: FlowEdge[] = [],
  rules: RoomLayoutRule[] = defaultRoomLayoutRules
): RoomGridShape[] {
  const shapes: RoomGridShape[] = [];
  for (const node of visibleNodes.filter((item) => item.parentId === scopeId)) {
    if (!isExpandedRoom(node, expandedScopeIds)) continue;
    const childNodes = visibleNodes.filter((child) => child.parentId === node.id);
    const structuralPositions = layoutNodesWithAreaDSL(childNodes, node.id, rules, edges);
    const xLanes = clusterCoordinates(structuralPositions.map((child) => child.x));
    const columns = Math.max(1, xLanes.length);
    const rows = Math.max(
      1,
      ...xLanes.map((lane) =>
        structuralPositions.filter((child) => Math.abs(child.x - lane) <= COORDINATE_CLUSTER_GAP).length
      )
    );
    shapes.push({ roomId: node.id, columns, rows });
  }
  return shapes;
}

export function getExpandedRoomFrames(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  expandedScopeIds: Set<string> = new Set(),
  edges: FlowEdge[] = [],
  savedLayout: GraphLayout = {},
  rules: RoomLayoutRule[] = defaultRoomLayoutRules,
  metrics: RoomFrameMetrics = DEFAULT_STAGE
): ExpandedRoomFrame[] {
  const directNodes = visibleNodes.filter((n) => n.parentId === scopeId);
  const directPositions = layoutNodesWithAreaDSL(directNodes, scopeId, rules, edges);
  const directPosMap = new Map(directPositions.map((n) => [n.id, n]));
  const shapes = new Map(
    getExpandedRoomShapes(visibleNodes, scopeId, expandedScopeIds, edges, rules)
      .map((shape) => [shape.roomId, shape])
  );

  const toWidth = (pixels: number) => (pixels / metrics.stageWidth) * 100;
  const toHeight = (pixels: number) => (pixels / metrics.stageHeight) * 100;
  const frames: ExpandedRoomFrame[] = [];

  for (const node of directNodes) {
    if (isExpandedRoom(node, expandedScopeIds)) {
      const childNodes = visibleNodes.filter((c) => c.parentId === node.id);
      const saved = savedLayout[node.id];
      const pos = saved ?? directPosMap.get(node.id) ?? { x: 50, y: 50 };
      const { columns, rows } = shapes.get(node.id) ?? { columns: 1, rows: 1 };

      // The frame holds real cards at a real pitch, so it is measured in pixels
      // and turned into a share of the stage once. stageMetrics has already
      // made the stage large enough for that share to stay under the cap.
      const pixels = roomFramePixelSize(columns, rows);
      const frameWidth = clamp(toWidth(pixels.width), 8, MAX_ROOM_FRAME_SHARE * 100);
      const frameHeight = clamp(toHeight(pixels.height), 10, MAX_ROOM_FRAME_SHARE * 100);
      const inwardShift = pos.x < 35 ? 12 : pos.x > 65 ? -12 : 0;
      const frameX = clamp(pos.x + inwardShift - frameWidth / 2, 1, 99 - frameWidth);
      const frameY = clamp(pos.y - frameHeight / 2, 3, 97 - frameHeight);

      // Children are placed on the centre box: the span their *centres* cover.
      // The frame is that span plus one whole card, so the outermost cards have
      // their half-widths inside the frame instead of hanging out of it.
      const halfCardWidth = toWidth(NESTED_CARD_WIDTH / 2);
      const halfCardHeight = toHeight(NESTED_CARD_HEIGHT / 2);
      const padding = toWidth(ROOM_FRAME_PADDING);
      const header = toHeight(ROOM_HEADER_HEIGHT);
      const centreLeft = frameX + padding + halfCardWidth;
      const centreTop = frameY + header + halfCardHeight;

      frames.push({
        roomId: node.id,
        title: node.title,
        bounds: {
          x: +frameX.toFixed(1),
          y: +frameY.toFixed(1),
          width: +frameWidth.toFixed(1),
          height: +frameHeight.toFixed(1),
        },
        contentBounds: {
          x: +centreLeft.toFixed(1),
          y: +centreTop.toFixed(1),
          width: +Math.max(0, frameWidth - padding * 2 - halfCardWidth * 2).toFixed(1),
          height: +Math.max(0, frameHeight - header - toHeight(ROOM_FRAME_PADDING) - halfCardHeight * 2).toFixed(1),
        },
        childCount: childNodes.length,
        columns,
        rows,
      });
    }
  }

  separateExpandedFrames(frames);
  return frames;
}

/**
 * Computes positions for all visible nodes using compact local frame projections for inline-expanded scopes.
 */
/**
 * Where this scope's own nodes sit before anything is moved out of the way of a
 * Room frame. The stage is sized from these: reflow only pushes cards apart to
 * fit the stage, so sizing the stage from reflowed positions would let the two
 * chase each other.
 */
export function getScopeBasePositions(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  edges: FlowEdge[] = [],
  savedLayout: GraphLayout = {},
  rules: RoomLayoutRule[] = defaultRoomLayoutRules
): PositionedFlowNode[] {
  const directNodes = visibleNodes.filter((node) => node.parentId === scopeId);
  const structural = new Map(
    layoutNodesWithAreaDSL(directNodes, scopeId, rules, edges).map((node) => [node.id, node])
  );
  return directNodes.map((node) => ({
    ...node,
    ...(savedLayout[node.id] ?? structural.get(node.id) ?? { x: 50, y: 50 }),
  }));
}

/** A node's centre and the room it takes, ready to be pushed apart. */
export type OverlapBox = { id: string; x: number; y: number; extent: NodeExtent };

// Enough space between two cards to read them as separate, and enough passes
// for a push to propagate along a row without running forever.
const OVERLAP_GAP = 10;
const OVERLAP_PASSES = 12;

/**
 * Moves boxes apart until none of them overlap, and does nothing else.
 *
 * Two rules make the result feel deliberate rather than random. A pair is
 * separated along whichever axis needs the least movement, so cards slide the
 * shortest distance that resolves the collision. And an anchored box never
 * moves: the Room the user unfolded, and the node whose plate they just opened,
 * are the things they are looking at, so everything else yields to them.
 *
 * Positions are percentages of the stage and sizes are pixels, so the work is
 * done in pixels and converted back once.
 */
export function resolveOverlaps(
  boxes: OverlapBox[],
  anchors: Set<string>,
  stage: RoomFrameMetrics
): Map<string, FlowNodePosition> {
  const toX = (pixels: number) => (pixels / stage.stageWidth) * 100;
  const toY = (pixels: number) => (pixels / stage.stageHeight) * 100;
  const positions = new Map(
    boxes.map((box) => [box.id, { x: box.x, y: box.y + toY(box.extent.offsetY) }])
  );

  for (let pass = 0; pass < OVERLAP_PASSES; pass += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
        const left = boxes[leftIndex]!;
        const right = boxes[rightIndex]!;
        const leftLocked = anchors.has(left.id);
        const rightLocked = anchors.has(right.id);
        if (leftLocked && rightLocked) continue;
        const leftPosition = positions.get(left.id)!;
        const rightPosition = positions.get(right.id)!;
        const deltaX = rightPosition.x - leftPosition.x;
        const deltaY = rightPosition.y - leftPosition.y;
        const penetrationX =
          toX((left.extent.width + right.extent.width) / 2 + OVERLAP_GAP) - Math.abs(deltaX);
        const penetrationY =
          toY((left.extent.height + right.extent.height) / 2 + OVERLAP_GAP) - Math.abs(deltaY);
        if (penetrationX <= 0 || penetrationY <= 0) continue;

        // The two penetrations are compared as shares of the stage rather than
        // as distances. Measuring them in pixels is the more obvious reading of
        // "least movement", and it was tried: a stage is much wider than it is
        // tall, so pixels make the vertical route look cheap and cards start
        // stacking instead of spreading. Shares keep the arrangement the layout
        // produced — which is left to right, because that is how a flow reads.
        const useX = penetrationX <= penetrationY;
        const push = useX ? penetrationX : penetrationY;
        // Which side to push towards comes from the coordinates, not from the
        // boxes. A plate makes its node's box reach far below the card, and a
        // neighbour that was underneath can end up above the middle of that
        // box — pushing along the boxes then flings it over to the other side
        // of the node it was below. The coordinates never move, so the
        // arrangement keeps the order the layout gave it.
        const order = useX ? right.x - left.x : right.y - left.y;
        const fallback = useX ? deltaX : deltaY;
        const direction = (order !== 0 ? order : fallback) >= 0 ? 1 : -1;
        const leftShare = leftLocked ? 0 : rightLocked ? 1 : 0.5;
        if (useX) {
          leftPosition.x -= direction * push * leftShare;
          rightPosition.x += direction * push * (1 - leftShare);
        } else {
          leftPosition.y -= direction * push * leftShare;
          rightPosition.y += direction * push * (1 - leftShare);
        }
        moved = true;
      }
    }
    for (const box of boxes) {
      if (anchors.has(box.id)) continue;
      const position = positions.get(box.id)!;
      position.x = clamp(position.x, toX(box.extent.width / 2) + 1, 99 - toX(box.extent.width / 2));
      position.y = clamp(position.y, toY(box.extent.height / 2) + 1, 99 - toY(box.extent.height / 2));
    }
    if (!moved) break;
  }

  return new Map(
    boxes.map((box) => {
      const position = positions.get(box.id)!;
      return [
        box.id,
        { x: +position.x.toFixed(1), y: +(position.y - toY(box.extent.offsetY)).toFixed(1) },
      ];
    })
  );
}

/**
 * Removes the empty band around the arrangement.
 *
 * The stage is sized so the tightest pair of cards clears itself, but the
 * layout only ever uses a strip of the coordinate space, so the rest of the
 * stage is empty and the canvas is mostly margin — measured at three tenths of
 * its height on the preview fixture.
 *
 * Nothing here changes how far apart anything is. The content's pixel bounding
 * box becomes the stage, and every coordinate is re-expressed against it, which
 * is a single affine remap: distances in pixels are exactly what they were, and
 * no overlap can appear. What changes is that the stage is smaller, so it is
 * drawn larger. It is also what makes closing something reclaim its space —
 * fewer or smaller boxes, a smaller box around them, a bigger picture.
 */
export function fitStageToContent(
  nodes: PositionedFlowNode[],
  frames: ExpandedRoomFrame[],
  extentOf: (node: PositionedFlowNode) => NodeExtent,
  stage: RoomFrameMetrics,
  marginPixels: number,
  /**
   * What decides the box, if not the nodes being remapped. The arrangement is
   * what the stage is fitted to — where the layout put things — and not the
   * transient displacement an open plate causes around itself. Otherwise
   * opening one node rescales and recentres the whole canvas beneath it.
   */
  bounds: PositionedFlowNode[] = nodes
): {
  stage: { width: number; height: number };
  nodes: PositionedFlowNode[];
  frames: ExpandedRoomFrame[];
} {
  const spans: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const node of bounds) {
    const extent = extentOf(node);
    const centreX = (node.x / 100) * stage.stageWidth;
    const centreY = (node.y / 100) * stage.stageHeight + extent.offsetY;
    spans.push({
      left: centreX - extent.width / 2,
      right: centreX + extent.width / 2,
      top: centreY - extent.height / 2,
      bottom: centreY + extent.height / 2,
    });
  }
  for (const frame of frames) {
    spans.push({
      left: (frame.bounds.x / 100) * stage.stageWidth,
      top: (frame.bounds.y / 100) * stage.stageHeight,
      right: ((frame.bounds.x + frame.bounds.width) / 100) * stage.stageWidth,
      bottom: ((frame.bounds.y + frame.bounds.height) / 100) * stage.stageHeight,
    });
  }
  if (spans.length === 0) return { stage: { width: stage.stageWidth, height: stage.stageHeight }, nodes, frames };

  const left = Math.min(...spans.map((span) => span.left)) - marginPixels;
  const top = Math.min(...spans.map((span) => span.top)) - marginPixels;
  const width = Math.max(...spans.map((span) => span.right)) + marginPixels - left;
  const height = Math.max(...spans.map((span) => span.bottom)) + marginPixels - top;
  if (width <= 0 || height <= 0) {
    return { stage: { width: stage.stageWidth, height: stage.stageHeight }, nodes, frames };
  }

  const remapX = (percent: number) =>
    +((((percent / 100) * stage.stageWidth - left) / width) * 100).toFixed(2);
  const remapY = (percent: number) =>
    +((((percent / 100) * stage.stageHeight - top) / height) * 100).toFixed(2);
  const scaleX = (percent: number) => +((percent / 100) * stage.stageWidth / width * 100).toFixed(2);
  const scaleY = (percent: number) => +((percent / 100) * stage.stageHeight / height * 100).toFixed(2);
  const remapBounds = (bounds: LayoutBounds): LayoutBounds => ({
    x: remapX(bounds.x),
    y: remapY(bounds.y),
    width: scaleX(bounds.width),
    height: scaleY(bounds.height),
  });

  return {
    stage: { width, height },
    nodes: nodes.map((node) => ({ ...node, x: remapX(node.x), y: remapY(node.y) })),
    frames: frames.map((frame) => ({
      ...frame,
      bounds: remapBounds(frame.bounds),
      contentBounds: remapBounds(frame.contentBounds),
    })),
  };
}

export function layoutFlowNodesWithExpandedScopes(
  visibleNodes: FlowNode[],
  scopeId: string | null = null,
  expandedScopeIds: Set<string> = new Set(),
  edges: FlowEdge[] = [],
  savedLayout: GraphLayout = {},
  rules: RoomLayoutRule[] = defaultRoomLayoutRules,
  view?: LayoutView
): PositionedFlowNode[] {
  const resolved = view ?? DEFAULT_STAGE;
  const directNodes = visibleNodes.filter((n) => n.parentId === scopeId);
  const frames = getExpandedRoomFrames(visibleNodes, scopeId, expandedScopeIds, edges, savedLayout, rules, view);
  const frameMap = new Map(frames.map((f) => [f.roomId, f]));
  const basePositionMap = new Map(
    getScopeBasePositions(visibleNodes, scopeId, edges, savedLayout, rules)
      .map((node) => [node.id, { x: node.x, y: node.y }])
  );
  // One pass over rectangles replaces four passes over special cases. An
  // unfolded Room is no longer a different kind of obstacle from an open plate:
  // both are boxes, and both are anchored, because they are what the user just
  // acted on and must not slide out from under them.
  const anchors = new Set<string>([
    ...frames.map((frame) => frame.roomId),
    ...(view?.expandedNodeIds ?? []),
  ]);
  const roomBoxes = frames.map((frame) => ({
    id: frame.roomId,
    x: frame.bounds.x + frame.bounds.width / 2,
    y: frame.bounds.y + frame.bounds.height / 2,
    extent: {
      width: (frame.bounds.width / 100) * resolved.stageWidth,
      height: (frame.bounds.height / 100) * resolved.stageHeight,
      offsetY: 0,
    },
  }));
  const loose = directNodes.filter((node) => !isExpandedRoom(node, expandedScopeIds));

  // Solved twice, and the first time as if nothing were open. A node that is
  // anchored is not displaced, so a node that becomes anchored the moment its
  // plate opens would snap back to where the layout had put it — the card the
  // user just clicked, jumping. Anchoring it at the arrangement it was already
  // part of holds it still.
  const settled = resolveOverlaps(
    [
      ...roomBoxes,
      ...loose.map((node) => ({
        id: node.id,
        ...basePositionMap.get(node.id)!,
        extent: nodeExtent({}),
      })),
    ],
    new Set(frames.map((frame) => frame.roomId)),
    resolved
  );

  const reflowedPositionMap = resolveOverlaps(
    [
      ...roomBoxes,
      ...loose.map((node) => ({
        id: node.id,
        ...(settled.get(node.id) ?? basePositionMap.get(node.id)!),
        extent: nodeExtent({
          expanded: view?.expandedNodeIds?.has(node.id),
          hasImplementation: Boolean(node.implementation),
        }),
      })),
    ],
    anchors,
    resolved
  );

  const result: PositionedFlowNode[] = [];

  // 1. Position direct scope nodes
  for (const node of directNodes) {
    const pos = basePositionMap.get(node.id)!;

    if (isExpandedRoom(node, expandedScopeIds)) {
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
        const localRelPositions = localRoomPositions(childNodes, node.id, edges, savedLayout, rules);
        for (const child of localRelPositions) {
          const childX = projectPercentage(child.x, frame.contentBounds.x, frame.contentBounds.width);
          const childY = projectPercentage(child.y, frame.contentBounds.y, frame.contentBounds.height);
          result.push({ ...child, x: childX, y: childY });
        }
      }
    } else {
      const reflowed = reflowedPositionMap.get(node.id) ?? pos;
      result.push({ ...node, x: reflowed.x, y: reflowed.y });
    }
  }

  return result;
}

const COORDINATE_CLUSTER_GAP = 10;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clusterCoordinates(values: number[]): number[] {
  const clusters: number[][] = [];
  for (const value of [...values].sort((left, right) => left - right)) {
    const cluster = clusters.at(-1);
    if (!cluster || value - cluster[cluster.length - 1]! > COORDINATE_CLUSTER_GAP) {
      clusters.push([value]);
    } else {
      cluster.push(value);
    }
  }
  return clusters.map((cluster) => cluster.reduce((sum, value) => sum + value, 0) / cluster.length);
}

function localRoomPositions(
  nodes: FlowNode[],
  roomId: string,
  edges: FlowEdge[],
  savedLayout: GraphLayout,
  rules: RoomLayoutRule[]
): PositionedFlowNode[] {
  const structural = layoutNodesWithAreaDSL(nodes, roomId, rules, edges);
  const xs = structural.map((node) => node.x);
  const ys = structural.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return structural.map((node) => {
    const normalized = {
      x: normalizeLocalCoordinate(node.x, minX, maxX),
      y: normalizeLocalCoordinate(node.y, minY, maxY),
    };
    const saved = savedLayout[node.id];
    const isCustom =
      saved && (Math.abs(saved.x - node.x) > 0.2 || Math.abs(saved.y - node.y) > 0.2);
    return { ...node, ...(isCustom ? saved : normalized) };
  });
}


// The full 0-100 range, because it is projected onto the box the frame reserves
// for card *centres*. The half-card margin that keeps the outermost cards
// inside the frame is part of the frame's own size, not of this range.
function normalizeLocalCoordinate(value: number, minimum: number, maximum: number): number {
  if (maximum - minimum < 0.1) return 50;
  return +(((value - minimum) / (maximum - minimum)) * 100).toFixed(1);
}

function projectPercentage(value: number, start: number, size: number): number {
  return +(start + (value / 100) * size).toFixed(1);
}

function separateExpandedFrames(frames: ExpandedRoomFrame[]): void {
  const gap = 1.3;
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < frames.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < frames.length; rightIndex += 1) {
        const left = frames[leftIndex]!;
        const right = frames[rightIndex]!;
        const overlapX =
          Math.min(left.bounds.x + left.bounds.width, right.bounds.x + right.bounds.width) -
          Math.max(left.bounds.x, right.bounds.x) + gap;
        const overlapY =
          Math.min(left.bounds.y + left.bounds.height, right.bounds.y + right.bounds.height) -
          Math.max(left.bounds.y, right.bounds.y) + gap;
        if (overlapX <= 0 || overlapY <= 0) continue;

        const useX = overlapX < overlapY;
        const leftCenter = useX
          ? left.bounds.x + left.bounds.width / 2
          : left.bounds.y + left.bounds.height / 2;
        const rightCenter = useX
          ? right.bounds.x + right.bounds.width / 2
          : right.bounds.y + right.bounds.height / 2;
        const direction = leftCenter <= rightCenter ? -1 : 1;
        const shift = (useX ? overlapX : overlapY) / 2;
        // Separating frames only moves them. The content box keeps its size and
        // its offset inside the frame, so it travels with it rather than being
        // recomputed from a second formula that could disagree with the first.
        const axis = useX ? "x" : "y";
        const span = useX ? "width" : "height";
        const lower = useX ? 1 : 3;
        const upper = useX ? 99 : 97;
        for (const [frame, sign] of [[left, direction], [right, -direction]] as const) {
          const moveTo = clamp(frame.bounds[axis] + sign * shift, lower, upper - frame.bounds[span]);
          frame.contentBounds[axis] = +(frame.contentBounds[axis] + (moveTo - frame.bounds[axis])).toFixed(1);
          frame.bounds[axis] = +moveTo.toFixed(1);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}


