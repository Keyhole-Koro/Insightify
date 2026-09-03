import { useMemo } from "react";
import {
  buildPortalPreview,
  getDebugAreasForScope,
  getExpandedRoomFrames,
  getExpandedRoomShapes,
  getScopeBasePositions,
  getNodeAreaIdsForScope,
  edgeLabelExtent,
  type FlowNodePosition,
  type OverlapBox,
  EDGE_LABEL_SCREEN_HEIGHT,
  fitStageToContent,
  layoutFlowNodesWithExpandedScopes,
  nodeExtent,
  PORTAL_CARD_HEIGHT,
  resolveOverlaps,
  projectFlowWithExpandedScopes,
  resolveRoomLayoutRules,
  scopeBoundaryPorts,
  type FlowNode,
  type GeneratedFlowGraph,
} from "@insightify/graph-domain";
import { semanticLevelForZoom, stageMetrics, stageScale } from "../semantic-zoom.js";
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
// Breathing room between the outermost card and the edge of the canvas.
const STAGE_MARGIN = 36;

type FlowProjectionInput = {
  graph: GeneratedFlowGraph | null;
  scopeId: string | null;
  renderedExpandedScopeIds: Set<string>;
  frame: { width: number; height: number };
  zoom: number;
  hoveredEdgeKey: string | null;
  selectedNodeId: string | null;
  peekNodeId: string | null;
  /** Nodes whose detail plate is open. They are larger, and they do not move. */
  expandedNodeIds: Set<string>;
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
    expandedNodeIds,
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
  const basePositions = useMemo(
    () => getScopeBasePositions(visibleNodes, activeScopeId, flowEdges, savedLayout, layoutRules),
    [visibleNodes, activeScopeId, flowEdges, savedLayout, layoutRules]
  );

  const stage = useMemo(
    () =>
      stageMetrics(
        basePositions
          .filter((node) => !renderedExpandedScopeIds.has(node.id))
          .map((node) => ({ ...node, ...nodeExtent({}) })),
        frame,
        roomShapes
      ),
    [basePositions, frame, renderedExpandedScopeIds, roomShapes]
  );

  const layoutView = useMemo(
    () => ({ stageWidth: stage.width, stageHeight: stage.height, expandedNodeIds }),
    [stage.width, stage.height, expandedNodeIds]
  );

  const placedNodes = useMemo(
    () =>
      layoutFlowNodesWithExpandedScopes(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules,
        layoutView
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules, layoutView]
  );

  const placedFrames = useMemo(
    () =>
      getExpandedRoomFrames(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        flowEdges,
        savedLayout,
        layoutRules,
        layoutView
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, flowEdges, savedLayout, layoutRules, layoutView]
  );

  // Everything is placed; now throw away the empty band around it. Distances in
  // pixels do not change, so this can only make the same picture larger.
  const fitted = useMemo(
    () =>
      fitStageToContent(
        placedNodes,
        placedFrames,
        // The box that decides the stage ignores an open plate. A plate is
        // transient — it should push its neighbours aside, not resize and
        // recentre the whole canvas under the card that was just clicked.
        (node) => nodeExtent({ nested: node.parentId !== activeScopeId }),
        { stageWidth: stage.width, stageHeight: stage.height },
        STAGE_MARGIN,
        basePositions.filter((node) => !renderedExpandedScopeIds.has(node.id))
      ),
    [placedNodes, placedFrames, activeScopeId, basePositions, renderedExpandedScopeIds, stage.width, stage.height]
  );
  const positionedNodes = fitted.nodes;
  const roomFrames = fitted.frames;
  // Everything below reads the stage the canvas actually draws, which is the
  // fitted one. The level a card is drawn at follows from it, and no longer
  // feeds back into the placement that produced it.
  const fittedStage = useMemo(
    () => ({ ...fitted.stage, scale: stageScale(fitted.stage, frame) }),
    [fitted.stage, frame]
  );
  const stageZoom = zoom * fittedStage.scale;
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

  // A label is a box on the canvas like any other, so it is kept off the cards
  // the same way a card is kept off another card. Cards and frames are anchored:
  // a label yields to the flow it describes, never the other way round.
  //
  // It starts just above the middle of its edge, which is where a reader looks
  // for it, and is moved from there by as little as possible.
  const edgeLabels = useMemo(() => {
    const labels = visualEdges
      .map((edge) => ({
        key: edge.key,
        bundled: edge.bundled,
        text: edge.bundled ? `${edge.count} connections` : edge.members[0]?.labels[0] ?? "",
        x: (edge.sourceX + edge.targetX) / 2,
        y: (edge.sourceY + edge.targetY) / 2,
      }))
      .filter((label) => label.text.length > 0);
    if (labels.length === 0) return labels;

    const lift =
      ((PORTAL_CARD_HEIGHT / 2 + EDGE_LABEL_SCREEN_HEIGHT / stageZoom) / fittedStage.height) * 100;
    const anchors = new Set<string>();
    const boxes = [
      ...positionedNodes.map((node) => {
        anchors.add(node.id);
        return {
          id: node.id,
          x: node.x,
          y: node.y,
          extent: nodeExtent({
            nested: node.parentId !== activeScopeId,
            expanded: expandedNodeIds.has(node.id),
          }),
        };
      }),
      ...roomFrames.map((frame) => {
        anchors.add(`frame:${frame.roomId}`);
        return {
          id: `frame:${frame.roomId}`,
          x: frame.bounds.x + frame.bounds.width / 2,
          y: frame.bounds.y + frame.bounds.height / 2,
          extent: {
            width: (frame.bounds.width / 100) * fittedStage.width,
            height: (frame.bounds.height / 100) * fittedStage.height,
            offsetY: 0,
          },
        };
      }),
      ...labels.map((label) => ({
        id: `label:${label.key}`,
        x: label.x,
        y: label.y - lift,
        extent: edgeLabelExtent(label.text, stageZoom),
      })),
    ];
    const placed = resolveOverlaps(boxes, anchors, {
      stageWidth: fittedStage.width,
      stageHeight: fittedStage.height,
    });
    // Placing eight labels among seven cards is a packing problem, and a
    // relaxation solver does not always have an answer: some labels are wedged
    // where nothing fits. Rather than leave those sitting on top of a card,
    // they are not drawn. A canvas that quietly shows less is easier to read
    // than one that shows everything on top of everything, and the edge is
    // still there to hover.
    //
    // A bundled label stands for several edges at once, so it is the last thing
    // to give up its place.
    const kept: Array<{ box: OverlapBox; label: (typeof labels)[number] & FlowNodePosition }> = [];
    // Centres, not coordinates: an open plate makes its card's box hang below
    // the point the card is anchored at.
    const centreY = (box: OverlapBox) => box.y + (box.extent.offsetY / fittedStage.height) * 100;
    const clears = (box: OverlapBox, other: OverlapBox): boolean => {
      const needX = ((box.extent.width + other.extent.width) / 2 + 6) / fittedStage.width * 100;
      const needY = ((box.extent.height + other.extent.height) / 2 + 6) / fittedStage.height * 100;
      return (
        Math.abs(box.x - other.x) >= needX || Math.abs(centreY(box) - centreY(other)) >= needY
      );
    };
    const obstacles = boxes.filter((box) => anchors.has(box.id));

    for (const label of [...labels].sort((left, right) => Number(right.bundled) - Number(left.bundled))) {
      const position = placed.get(`label:${label.key}`);
      if (!position) continue;
      const box: OverlapBox = {
        id: `label:${label.key}`,
        ...position,
        extent: edgeLabelExtent(label.text, stageZoom),
      };
      if (!obstacles.every((other) => clears(box, other))) continue;
      if (!kept.every((other) => clears(box, other.box))) continue;
      kept.push({ box, label: { ...label, ...position } });
    }
    return kept.map((item) => item.label);
  }, [visualEdges, positionedNodes, roomFrames, activeScopeId, expandedNodeIds, fittedStage, stageZoom]);

  const projected = useMemo(
    () => frameProjection(fittedStage.width, fittedStage.height, stageZoom, frame),
    [fittedStage, stageZoom, frame]
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
    stage: fittedStage,
    stageZoom,
    lod,
    debugAreas,
    editableEdges,
    previews,
    visualEdges,
    edgeLabels,
    hoveredEdge,
    projected,
    portRail,
    scopePath,
    scopeNode,
    selectedNode,
    peekNode,
  };
}
