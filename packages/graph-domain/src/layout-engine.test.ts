import { describe, expect, it } from "vitest";
import {
  LAYOUT_ENGINE_VERSION,
  parseSemanticLayoutPlanText,
  withLayoutPlan,
  isExpandedRoom,
  isRoom,
  parseFlowGraph,
  roomIds,
  roomsInScope,
  withCurrentLayoutEngine,
  type GeneratedFlowGraph,
} from "./index.js";

const graph = parseFlowGraph({
  title: "Versioned flow",
  summary: "A graph whose coordinates carry an engine version",
  nodes: [
    { id: "gateway", title: "Gateway", summary: "Entry room", kind: "room", parentId: null, evidence: [] },
    { id: "store", title: "Store", summary: "Keeps data", kind: "database", parentId: null, evidence: [] },
    { id: "router", title: "Router", summary: "Routes", kind: "api", parentId: "gateway", evidence: [] },
    { id: "inner", title: "Inner", summary: "Nested room", kind: "room", parentId: "gateway", evidence: [] },
  ],
  edges: [{ source: "gateway", target: "store", label: "writes" }],
});

function document(over: Partial<GeneratedFlowGraph> = {}): GeneratedFlowGraph {
  return {
    projectId: "0b6f4d3e-3f2a-4b7c-8d1e-9a0c5f2b7d41",
    provider: "codex",
    snapshotHash: "hash",
    generatedAt: "2026-08-29T00:00:00.000Z",
    graph,
    layout: { gateway: { x: 11, y: 11 }, store: { x: 12, y: 12 } },
    ...over,
  };
}

describe("withCurrentLayoutEngine", () => {
  it("leaves a document laid out by the current engine untouched", () => {
    const current = document({ layoutEngineVersion: LAYOUT_ENGINE_VERSION });
    expect(withCurrentLayoutEngine(current)).toBe(current);
  });

  it("recomputes coordinates written by an older engine", () => {
    const stale = withCurrentLayoutEngine(document({ layoutEngineVersion: LAYOUT_ENGINE_VERSION - 1 }));
    expect(stale.layoutEngineVersion).toBe(LAYOUT_ENGINE_VERSION);
    expect(stale.layout.gateway).not.toEqual({ x: 11, y: 11 });
    expect(stale.layout.gateway).toBeDefined();
  });

  it("recomputes a document saved before the version existed", () => {
    const migrated = withCurrentLayoutEngine(document());
    expect(migrated.layoutEngineVersion).toBe(LAYOUT_ENGINE_VERSION);
  });

  it("never discards the positions the user dragged by hand", () => {
    const overrides = { gateway: { x: 80, y: 20 } };
    const migrated = withCurrentLayoutEngine(
      document({ layoutEngineVersion: 1, layoutOverrides: overrides })
    );
    expect(migrated.layoutOverrides).toEqual(overrides);
  });
});

describe("Room predicates", () => {
  it("recognises a Room by kind", () => {
    expect(isRoom(graph.nodes[0])).toBe(true);
    expect(isRoom(graph.nodes[1])).toBe(false);
  });

  it("treats a Room as expanded only while it is in the open set", () => {
    const room = graph.nodes[0];
    expect(isExpandedRoom(room, new Set(["gateway"]))).toBe(true);
    expect(isExpandedRoom(room, new Set())).toBe(false);
    // A non-Room in the open set is still not an expanded Room.
    expect(isExpandedRoom(graph.nodes[1], new Set(["store"]))).toBe(false);
  });

  it("collects Rooms across the whole graph, but only one generation per scope", () => {
    expect([...roomIds(graph)].sort()).toEqual(["gateway", "inner"]);
    expect(roomsInScope(graph, null).map((node) => node.id)).toEqual(["gateway"]);
    expect(roomsInScope(graph, "gateway").map((node) => node.id)).toEqual(["inner"]);
  });
});

describe("withLayoutPlan", () => {
  const plan = parseSemanticLayoutPlanText(`\`\`\`json
    {
      "version": 1,
      "scopes": [
        {
          "roomId": null,
          "direction": "row",
          "areas": [
            { "id": "entry", "label": "Entry", "direction": "column", "nodeIds": ["gateway"] },
            { "id": "state", "label": "State", "direction": "column", "nodeIds": ["store"] }
          ]
        }
      ]
    }
  \`\`\``);

  it("reads a plan the model wrapped in a code fence", () => {
    expect(plan.scopes[0]!.areas.map((area) => area.id)).toEqual(["entry", "state"]);
  });

  it("leaves the graph exactly as it was", () => {
    const before = document();
    const after = withLayoutPlan(before, plan);
    expect(after.graph).toBe(before.graph);
    expect(after.snapshotHash).toBe(before.snapshotHash);
  });

  it("rebuilds the generated coordinates from the new plan", () => {
    const after = withLayoutPlan(document(), plan);
    expect(after.layoutPlan).toEqual(plan);
    expect(after.layout.gateway).not.toEqual({ x: 11, y: 11 });
    // The plan puts the two nodes in separate areas of a row, left before right.
    expect(after.layout.gateway!.x).toBeLessThan(after.layout.store!.x);
    expect(after.layoutEngineVersion).toBe(LAYOUT_ENGINE_VERSION);
  });

  it("never discards a position the user placed by hand", () => {
    const overrides = { store: { x: 20, y: 80 } };
    const after = withLayoutPlan(document({ layoutOverrides: overrides }), plan);
    expect(after.layoutOverrides).toEqual(overrides);
  });
});
