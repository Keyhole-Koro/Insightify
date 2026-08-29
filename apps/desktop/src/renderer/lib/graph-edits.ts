import type { FlowEdge, FlowNode, FlowNodePosition, GeneratedFlowGraph } from "@insightify/graph-domain";
import { descendantIds } from "./flowfold-helpers.js";

// Every edit the canvas can make to a saved graph, as a pure value-to-value
// function. Keeping them here means the React layer only decides *when* an edit
// happens, never *what* it produces, and each rule is testable without a DOM.

export function patchNode(
  document: GeneratedFlowGraph,
  nodeId: string,
  patch: Partial<FlowNode>
): GeneratedFlowGraph {
  return {
    ...document,
    graph: {
      ...document.graph,
      nodes: document.graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    },
  };
}

// Deleting a Room deletes the flow inside it. Edges and saved positions of the
// removed nodes go with them, or the graph would fail its own schema.
export function removeNodeAndDescendants(
  document: GeneratedFlowGraph,
  nodeId: string
): GeneratedFlowGraph {
  const removed = descendantIds(document.graph.nodes, nodeId);
  return {
    ...document,
    graph: {
      ...document.graph,
      nodes: document.graph.nodes.filter((node) => !removed.has(node.id)),
      edges: document.graph.edges.filter(
        (edge) => !removed.has(edge.source) && !removed.has(edge.target)
      ),
    },
    layout: Object.fromEntries(
      Object.entries(document.layout).filter(([id]) => !removed.has(id))
    ),
    ...(document.layoutOverrides
      ? {
          layoutOverrides: Object.fromEntries(
            Object.entries(document.layoutOverrides).filter(([id]) => !removed.has(id))
          ),
        }
      : {}),
    ...(document.layoutPlan
      ? {
          layoutPlan: {
            ...document.layoutPlan,
            scopes: document.layoutPlan.scopes
              .filter((scope) => scope.roomId === null || !removed.has(scope.roomId))
              .map((scope) => ({
                ...scope,
                areas: scope.areas.map((area) => ({
                  ...area,
                  nodeIds: area.nodeIds.filter((id) => !removed.has(id)),
                })),
              })),
          },
        }
      : {}),
  };
}

export function upsertEdge(
  document: GeneratedFlowGraph,
  edge: FlowEdge,
  index: number | null
): GeneratedFlowGraph {
  return {
    ...document,
    graph: {
      ...document.graph,
      edges:
        index === null
          ? [...document.graph.edges, edge]
          : document.graph.edges.map((item, position) => (position === index ? edge : item)),
    },
  };
}

export function removeEdgeAt(document: GeneratedFlowGraph, index: number): GeneratedFlowGraph {
  return {
    ...document,
    graph: {
      ...document.graph,
      edges: document.graph.edges.filter((_edge, position) => position !== index),
    },
  };
}

export function placeNode(
  document: GeneratedFlowGraph,
  nodeId: string,
  position: FlowNodePosition
): GeneratedFlowGraph {
  return {
    ...document,
    layoutOverrides: { ...(document.layoutOverrides ?? {}), [nodeId]: position },
  };
}
