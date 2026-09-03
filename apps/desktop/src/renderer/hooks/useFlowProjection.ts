import { useMemo } from "react";
import {
  buildPortalPreview,
  getDebugAreasForScope,
  getExpandedRoomFrames,
  getExpandedRoomShapes,
  getScopeBasePositions,
  getNodeAreaIdsForScope,
  layoutFlowNodesWithExpandedScopes,
  projectFlowWithExpandedScopes,
  resolveRoomLayoutRules,
  scopeBoundaryPorts,
  type FlowNode,
  type GeneratedFlowGraph,
} from "@insightify/graph-domain";
import {
  PORTAL_CARD_HEIGHT,
  PORTAL_CARD_WIDTH,
  semanticLevelForZoom,
  stageMetrics,
} from "../semantic-zoom.js";
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

  // The order below is the whole point. A Room frame is a share of the stage,
  // and the stage has to be big enough for that share to hold real cards — so
  // the two cannot each be derived from the other. The shape of a Room (its
  // lanes and rows) needs neither, so it comes first, the stage second, and the
  // frames last, against a stage that is already known to fit them.
  const roomShapes = useMemo(
    () =>
      getExpandedRoomShapes(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        layoutRules
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, layoutRules]
  );

  // Only this scope's own cards set the stage size, and at their pre-reflow
  // positions: reflow exists to fit cards into the stage, so letting it grow
  // the stage would chase its own tail.
  const stage = useMemo(
    () =>
      stageMetrics(
        getScopeBasePositions(visibleNodes, activeScopeId, flowEdges, savedLayout, layoutRules)
          .filter((node) => !renderedExpandedScopeIds.has(node.id))
          .map((node) => ({ ...node, width: PORTAL_CARD_WIDTH, height: PORTAL_CARD_HEIGHT })),
        frame,
        roomShapes
      ),
    [visibleNodes, activeScopeId, flowEdges, savedLayout, layoutRules, frame, renderedExpandedScopeIds, roomShapes]
  );

  const stageMetricsForFrames = useMemo(
    () => ({ stageWidth: stage.width, stageHeight: stage.height }),
    [stage.width, stage.height]
  );

  const positionedNodes = useMemo(
    () =>
      layoutFlowNodesWithExpandedScopes(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules,
        stageMetricsForFrames
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules, stageMetricsForFrames]
  );

  const roomFrames = useMemo(
    () =>
      getExpandedRoomFrames(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules,
        stageMetricsForFrames
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules, stageMetricsForFrames]
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
    /** This scope's own children — what the FlowFold density rule is about. */
    directNodes,
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
