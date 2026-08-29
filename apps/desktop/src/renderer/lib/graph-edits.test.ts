import { describe, expect, it } from "vitest";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import {
  patchNode,
  placeNode,
  removeEdgeAt,
  removeNodeAndDescendants,
  upsertEdge,
} from "./graph-edits.js";

const node = (id: string, parentId: string | null): FlowNode => ({
  id,
  title: id,
  summary: `${id} summary`,
  kind: parentId === null ? "room" : "service",
  parentId,
  evidence: [],
});

function document(): GeneratedFlowGraph {
  return {
    projectId: "0b6f4d3e-3f2a-4b7c-8d1e-9a0c5f2b7d41",
    provider: "codex",
    snapshotHash: "hash",
    generatedAt: "2026-08-29T00:00:00.000Z",
    graph: {
      title: "Flow",
      summary: "Test flow",
      nodes: [node("gateway", null), node("router", "gateway"), node("guard", "router"), node("store", null)],
      edges: [
        { source: "guard", target: "store", label: "writes" },
        { source: "gateway", target: "store", label: "reads" },
      ],
    },
    layout: {
      gateway: { x: 20, y: 40 },
      router: { x: 30, y: 50 },
      guard: { x: 40, y: 60 },
      store: { x: 80, y: 40 },
    },
  };
}

describe("patchNode", () => {
  it("rewrites only the named node", () => {
    const next = patchNode(document(), "router", { title: "REST router", tags: ["rest"] });
    expect(next.graph.nodes.find((item) => item.id === "router")).toMatchObject({
      title: "REST router",
      tags: ["rest"],
      summary: "router summary",
    });
    expect(next.graph.nodes.find((item) => item.id === "guard")?.title).toBe("guard");
  });

  it("leaves the original document untouched", () => {
    const original = document();
    patchNode(original, "router", { title: "changed" });
    expect(original.graph.nodes.find((item) => item.id === "router")?.title).toBe("router");
  });
});

describe("removeNodeAndDescendants", () => {
  it("removes the whole subtree, its edges and its saved positions", () => {
    const next = removeNodeAndDescendants(document(), "gateway");
    expect(next.graph.nodes.map((item) => item.id)).toEqual(["store"]);
    // "guard -> store" and "gateway -> store" both lost an endpoint.
    expect(next.graph.edges).toEqual([]);
    expect(Object.keys(next.layout)).toEqual(["store"]);
  });

  it("keeps siblings and unrelated edges", () => {
    const next = removeNodeAndDescendants(document(), "guard");
    expect(next.graph.nodes.map((item) => item.id)).toEqual(["gateway", "router", "store"]);
    expect(next.graph.edges).toEqual([{ source: "gateway", target: "store", label: "reads" }]);
    expect(next.layout.guard).toBeUndefined();
  });
});

describe("upsertEdge", () => {
  it("appends when the index is null", () => {
    const next = upsertEdge(document(), { source: "router", target: "store", label: "caches" }, null);
    expect(next.graph.edges).toHaveLength(3);
    expect(next.graph.edges[2]).toEqual({ source: "router", target: "store", label: "caches" });
  });

  it("replaces the edge at the given index", () => {
    const next = upsertEdge(document(), { source: "guard", target: "store", label: "appends" }, 0);
    expect(next.graph.edges).toHaveLength(2);
    expect(next.graph.edges[0].label).toBe("appends");
  });
});

describe("removeEdgeAt", () => {
  it("drops only the indexed edge", () => {
    const next = removeEdgeAt(document(), 0);
    expect(next.graph.edges).toEqual([{ source: "gateway", target: "store", label: "reads" }]);
  });
});

describe("placeNode", () => {
  it("writes a manual override without replacing the generated layout", () => {
    const original = document();
    const next = placeNode(original, "router", { x: 55, y: 65 });
    expect(next.layoutOverrides?.router).toEqual({ x: 55, y: 65 });
    expect(next.layout.router).toEqual({ x: 30, y: 50 });
    expect(next.graph).toBe(original.graph);
  });
});
