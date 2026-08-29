import { useMemo } from "react";
import {
  buildPortalPreview,
  getDebugAreasForScope,
  getExpandedRoomFrames,
  getNodeAreaIdsForScope,
  layoutFlowNodesWithExpandedScopes,
  projectFlowWithExpandedScopes,
  resolveRoomLayoutRules,
  scopeBoundaryPorts,
  type FlowNode,
  type GeneratedFlowGraph,
} from "@insightify/graph-domain";
import { semanticLevelForZoom, stageMetrics } from "../semantic-zoom.js";
import {
  buildScopePath,
  bundleEdgesByVisualArea,
  frameProjection,
  isRoomEdge,
  layoutBoundaryRail,
  toFlowEdge,
  type RoomEdge,
} from "../lib/flowfold-helpers.js";

// The whole read path from the saved document to what the canvas draws: one
// scope's nodes, its edges, its boundary, its coordinates. Every value here is
// derived — nothing in this hook is stored, and nothing calls out to the bridge.

const ROOT_CARD_WIDTH = 190;
const ROOT_CARD_HEIGHT = 82;
const emptyNodes: FlowNode[] = [];

type FlowProjectionInput = {
  graph: GeneratedFlowGraph | null;
  scopeId: string | null;
  renderedExpandedScopeIds: Set<string>;
  frame: { width: number; height: number };
  zoom: number;
  hoveredEdgeKey: string | null;
  selectedNodeId: string | null;
  peekNodeId: string | null;
};

export function useFlowProjection(input: FlowProjectionInput) {
  const {
    graph,
    scopeId,
    renderedExpandedScopeIds,
    frame,
    zoom,
    hoveredEdgeKey,
    selectedNodeId,
    peekNodeId,
  } = input;

  // A Room the user was standing in can disappear when a graph is regenerated.
  // Falling back to the root keeps the canvas on a scope that still exists.
  const activeScopeId = useMemo(() => {
    if (!scopeId || !graph) return null;
    return graph.graph.nodes.some((node) => node.id === scopeId) ? scopeId : null;
  }, [graph, scopeId]);

  const projection = useMemo(
    () =>
      graph ? projectFlowWithExpandedScopes(graph.graph, activeScopeId, renderedExpandedScopeIds) : null,
    [graph, activeScopeId, renderedExpandedScopeIds]
  );
  const visibleNodes = projection?.nodes ?? emptyNodes;

  const roomEdges = useMemo(
    () => (projection?.edges ?? []).filter(isRoomEdge) as RoomEdge[],
    [projection]
  );
  const flowEdges = useMemo(() => roomEdges.map(toFlowEdge), [roomEdges]);

  const boundaryPorts = useMemo(
    () => (graph ? scopeBoundaryPorts(graph.graph, activeScopeId) : []),
    [graph, activeScopeId]
  );

  const layoutRules = useMemo(
    () => (graph ? resolveRoomLayoutRules(graph.graph, graph.layoutPlan) : undefined),
    [graph]
  );
  const savedLayout = useMemo(
    () => ({ ...(graph?.layout ?? {}), ...(graph?.layoutOverrides ?? {}) }),
    [graph?.layout, graph?.layoutOverrides]
  );

  const positionedNodes = useMemo(
    () =>
      layoutFlowNodesWithExpandedScopes(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules]
  );

  const roomFrames = useMemo(
    () =>
      getExpandedRoomFrames(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules]
  );

  // Only this scope's own cards set the stage size. A node inside an unfolded
  // Room sits at a deliberately tight pitch, and reading that pitch as the gap
  // between two ordinary cards demanded a stage several screens tall — which
  // then scaled every card down and left the canvas mostly empty. The Rooms
  // themselves are passed separately, as frames that must fit their contents.
  const stage = useMemo(
    () =>
      stageMetrics(
        positionedNodes
          .filter((node) => node.parentId === activeScopeId)
          .filter((node) => !renderedExpandedScopeIds.has(node.id))
          .map((node) => ({ ...node, width: ROOT_CARD_WIDTH, height: ROOT_CARD_HEIGHT })),
        frame,
        roomFrames
      ),
    [positionedNodes, frame, renderedExpandedScopeIds, activeScopeId, roomFrames]
  );
  const stageZoom = zoom * stage.scale;
  const lod = useMemo(() => semanticLevelForZoom("flow", stageZoom), [stageZoom]);

  // Areas describe how this scope arranges its own nodes. Feeding the children
  // of an unfolded Room into that calculation moved and stretched the areas of
  // the scope above them, which own neither those nodes nor that space.
  const directNodes = useMemo(
    () => visibleNodes.filter((node) => node.parentId === activeScopeId),
    [visibleNodes, activeScopeId]
  );
  const debugAreas = useMemo(
    () => getDebugAreasForScope(activeScopeId, directNodes, layoutRules),
    [activeScopeId, directNodes, layoutRules]
  );

  const positions = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const editableEdges = useMemo(
    () =>
      graph?.graph.edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ edge }) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) ?? [],
    [graph, visibleIds]
  );

  const previews = useMemo(
    () =>
      new Map(
        graph
          ? visibleNodes.map((node) => [
              node.id,
              buildPortalPreview(graph.graph, node.id, undefined, layoutRules),
            ] as const)
          : []
      ),
    [visibleNodes, graph, layoutRules]
  );

  const areaIds = useMemo(
    () =>
      getNodeAreaIdsForScope(
        activeScopeId,
        positionedNodes.filter((node) => node.parentId === activeScopeId),
        layoutRules
      ),
    [activeScopeId, positionedNodes, layoutRules]
  );

  const visualEdges = useMemo(
    () => bundleEdgesByVisualArea(roomEdges, positionedNodes, activeScopeId, areaIds, roomFrames),
    [roomEdges, positionedNodes, activeScopeId, areaIds, roomFrames]
  );
  const hoveredEdge = visualEdges.find((edge) => edge.key === hoveredEdgeKey) ?? null;

  const projected = useMemo(
    () => frameProjection(stage.width, stage.height, stageZoom, frame),
    [stage, stageZoom, frame]
  );
  const portRail = useMemo(
    () => layoutBoundaryRail(boundaryPorts, positionedNodes, projected),
    [boundaryPorts, positionedNodes, projected]
  );

  const scopePath = useMemo(() => buildScopePath(graph, activeScopeId), [graph, activeScopeId]);
  const scopeNode = activeScopeId
    ? graph?.graph.nodes.find((node) => node.id === activeScopeId) ?? null
    : null;
  const selectedNode = graph?.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const peekNode = graph?.graph.nodes.find((node) => node.id === peekNodeId) ?? null;

  return {
    activeScopeId,
    visibleNodes,
    roomEdges,
    boundaryPorts,
    positionedNodes,
    positions,
    roomFrames,
    stage,
    stageZoom,
    lod,
    debugAreas,
    editableEdges,
    previews,
    visualEdges,
    hoveredEdge,
    projected,
    portRail,
    scopePath,
    scopeNode,
    selectedNode,
    peekNode,
  };
}
