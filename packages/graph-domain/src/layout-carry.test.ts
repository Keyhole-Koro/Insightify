import { describe, expect, it } from "vitest";
import {
  parseFlowGraph,
  parseSemanticLayoutPlan,
  pruneLayoutToGraph,
  withGraphAndPlan,
  type FlowGraph,
  type FlowNode,
  type SemanticLayoutPlan,
} from "./index.js";

const node = (id: string, parentId: string | null, kind: FlowNode["kind"] = "service"): FlowNode => ({
  id,
  title: id,
  summary: `${id} summary`,
  kind,
  parentId,
  evidence: [`src/${id}.ts`],
});

const graphOf = (nodes: FlowNode[]): FlowGraph =>
  parseFlowGraph({ title: "Graph", summary: "A graph", nodes, edges: [] });

const planFor = (nodeIds: string[]): SemanticLayoutPlan =>
  parseSemanticLayoutPlan({
    version: 1,
    scopes: [
      { roomId: null, direction: "row", areas: [{ id: "all", label: "All", direction: "column", nodeIds }] },
    ],
  });

describe("pruneLayoutToGraph", () => {
  it("drops the coordinate of a node that no longer exists", () => {
    const previous = graphOf([node("alpha", null), node("beta", null)]);
    const next = graphOf([node("alpha", null)]);
    expect(pruneLayoutToGraph({ alpha: { x: 10, y: 10 }, beta: { x: 20, y: 20 } }, previous, next)).toEqual({
      alpha: { x: 10, y: 10 },
    });
  });

  // The failure this guards against is silent rather than loud: the coordinate
  // survives, but a Room reads it as its own 0-100 space instead of the stage's.
  it("drops the coordinate of a node that changed parent", () => {
    const previous = graphOf([node("room", null, "room"), node("alpha", null)]);
    const next = graphOf([node("room", null, "room"), node("alpha", "room")]);
    expect(pruneLayoutToGraph({ alpha: { x: 80, y: 80 } }, previous, next)).toEqual({});
  });

  it("keeps a coordinate whose node stayed in the same scope", () => {
    const previous = graphOf([node("room", null, "room"), node("alpha", "room")]);
    const next = graphOf([node("room", null, "room"), node("alpha", "room"), node("beta", "room")]);
    expect(pruneLayoutToGraph({ alpha: { x: 30, y: 40 } }, previous, next)).toEqual({
      alpha: { x: 30, y: 40 },
    });
  });

  it("keeps every surviving coordinate when there is no previous graph", () => {
    const next = graphOf([node("alpha", null)]);
    expect(pruneLayoutToGraph({ alpha: { x: 5, y: 5 } }, null, next)).toEqual({ alpha: { x: 5, y: 5 } });
  });
});

describe("withGraphAndPlan", () => {
  const previousGraph = graphOf([node("room", null, "room"), node("alpha", null), node("beta", null)]);
  const nextGraph = graphOf([node("room", null, "room"), node("alpha", "room"), node("beta", null)]);

  it("never carries a hand-placed coordinate through a re-parenting", () => {
    const slice = withGraphAndPlan(
      {
        graph: previousGraph,
        layout: {},
        layoutOverrides: { alpha: { x: 90, y: 90 }, beta: { x: 20, y: 20 } },
      },
      nextGraph,
      planFor(["room", "beta"])
    );
    expect(slice.layoutOverrides).toEqual({ beta: { x: 20, y: 20 } });
  });

  it("rebuilds every generated coordinate when the plan replaces the whole graph", () => {
    const slice = withGraphAndPlan(
      { graph: previousGraph, layout: { beta: { x: 90, y: 10 } } },
      nextGraph,
      planFor(["room", "beta"])
    );
    expect(slice.layout.beta).not.toEqual({ x: 90, y: 10 });
  });

  it("leaves an untouched scope where it was when a graph only grows", () => {
    const slice = withGraphAndPlan(
      { graph: previousGraph, layout: { beta: { x: 90, y: 10 } } },
      nextGraph,
      planFor(["room", "beta"]),
      { carryGeneratedCoordinates: true }
    );
    expect(slice.layout.beta).toEqual({ x: 90, y: 10 });
  });

  it("still drops a re-parented node while carrying the rest", () => {
    const slice = withGraphAndPlan(
      { graph: previousGraph, layout: { alpha: { x: 90, y: 90 }, beta: { x: 90, y: 10 } } },
      nextGraph,
      planFor(["room", "beta"]),
      { carryGeneratedCoordinates: true }
    );
    expect(slice.layout.beta).toEqual({ x: 90, y: 10 });
    // Rebuilt inside the Room's local space, not kept as the stage coordinate.
    expect(slice.layout.alpha).not.toEqual({ x: 90, y: 90 });
  });
});

describe("flowGraphSchema", () => {
  it("rejects a cycle of parents", () => {
    expect(() =>
      graphOf([
        { ...node("alpha", "beta"), kind: "room" },
        { ...node("beta", "alpha"), kind: "room" },
      ])
    ).toThrow(/Parent cycle/);
  });
});
