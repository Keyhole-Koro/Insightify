import type { FlowGraph, FlowNode } from "./index.js";

// A Room is the one node kind that can contain a flow. It is a convention on
// `kind`, not a separate type, so every place that needs the distinction asks
// here instead of restating the comparison. Types only are imported from the
// schema module, which keeps this a leaf and avoids an import cycle.

export function isRoom(node: FlowNode): boolean {
  return node.kind === "room";
}

/** A Room the canvas has been asked to unfold in place. */
export function isExpandedRoom(node: FlowNode, expandedScopeIds: ReadonlySet<string>): boolean {
  return isRoom(node) && expandedScopeIds.has(node.id);
}

export function roomIds(graph: FlowGraph): Set<string> {
  return new Set(graph.nodes.filter(isRoom).map((node) => node.id));
}

/** The Rooms directly inside a scope — the ones an "expand all" applies to. */
export function roomsInScope(graph: FlowGraph, scopeId: string | null): FlowNode[] {
  return graph.nodes.filter((node) => isRoom(node) && node.parentId === scopeId);
}
