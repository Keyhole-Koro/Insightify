import { describe, expect, it } from "vitest";
import {
  FLOWFOLD_ROOM_MAX_NODES,
  balanceFlowGraphScopes,
  parseGeneratedFlowGraph,
} from "@insightify/graph-domain";
import { previewGraph } from "../../preview/fixture.js";

// The preview fixture is what the visual QA harness measures, so a shape the
// real pipeline cannot produce would make every number it reports describe a
// document that never exists. These are the two properties a generated document
// is guaranteed to have.
describe("preview fixture", () => {
  it("is a document the domain would accept", () => {
    expect(() => parseGeneratedFlowGraph(previewGraph)).not.toThrow();
  });

  it("carries the layout plan a generation always produces", () => {
    expect(previewGraph.layoutPlan).toBeDefined();
    const scopes = new Set(previewGraph.layoutPlan?.scopes.map((scope) => scope.roomId));
    const rooms = previewGraph.graph.nodes.filter((node) =>
      previewGraph.graph.nodes.some((child) => child.parentId === node.id)
    );
    expect(scopes).toContain(null);
    for (const room of rooms) expect(scopes).toContain(room.id);
  });

  it("holds no more nodes in a scope than FlowFold allows", () => {
    const counts = new Map<string | null, number>();
    for (const node of previewGraph.graph.nodes) {
      counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
    }
    for (const [scope, count] of counts) {
      expect({ scope, count }).toEqual({ scope, count: Math.min(count, FLOWFOLD_ROOM_MAX_NODES) });
    }
  });

  it("needs no rebalancing, so it is not measuring the overflow path", () => {
    expect(balanceFlowGraphScopes(previewGraph.graph).nodes).toHaveLength(
      previewGraph.graph.nodes.length
    );
  });
});
