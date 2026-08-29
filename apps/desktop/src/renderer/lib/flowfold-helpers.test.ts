import { describe, expect, it } from "vitest";
import type { ExpandedRoomFrame, FlowNode } from "@insightify/graph-domain";
import { bundleEdgesByVisualArea, shouldShowNodeAvatar, type RoomEdge } from "./flowfold-helpers.js";

const edge = (source: string, target: string, label: string): RoomEdge => ({
  source,
  target,
  sourceOutsideId: null,
  targetOutsideId: null,
  labels: [label],
  count: 1,
});

describe("bundleEdgesByVisualArea", () => {
  const nodes: Array<FlowNode & { x: number; y: number }> = [
    { id: "api-one", title: "API one", summary: "One", kind: "api", parentId: "gateway", evidence: [], x: 20, y: 42 },
    { id: "api-two", title: "API two", summary: "Two", kind: "api", parentId: "gateway", evidence: [], x: 28, y: 52 },
    { id: "db-one", title: "DB one", summary: "One", kind: "database", parentId: null, evidence: [], x: 70, y: 42 },
    { id: "db-two", title: "DB two", summary: "Two", kind: "database", parentId: null, evidence: [], x: 76, y: 52 },
  ];
  const frame: ExpandedRoomFrame = {
    roomId: "gateway",
    title: "Gateway",
    bounds: { x: 14, y: 32, width: 20, height: 30 },
    contentBounds: { x: 17, y: 38, width: 14, height: 20 },
    childCount: 2,
    columns: 1,
    rows: 2,
  };

  it("creates one trunk for multiple edges crossing the same two visual areas", () => {
    const bundles = bundleEdgesByVisualArea(
      [edge("api-one", "db-one", "insert"), edge("api-two", "db-two", "query")],
      nodes,
      null,
      { "db-one": "data", "db-two": "data" },
      [frame]
    );

    expect(bundles).toHaveLength(1);
    expect(bundles[0]).toMatchObject({ bundled: true, count: 2, sourceX: 34 });
    expect(bundles[0]!.members.map((member) => member.labels[0])).toEqual(["insert", "query"]);
  });

  it("keeps edges inside one visual area separate", () => {
    const bundles = bundleEdgesByVisualArea(
      [edge("api-one", "api-two", "next")],
      nodes,
      null,
      {},
      [frame]
    );

    expect(bundles).toHaveLength(1);
    expect(bundles[0]).toMatchObject({ bundled: false, count: 1, sourceX: 20, targetX: 28 });
  });
});

describe("shouldShowNodeAvatar", () => {
  it("omits avatar icon when multiple sibling nodes share the same kind in the same scope", () => {
    const testNodes: FlowNode[] = [
      { id: "root-ui", title: "Web UI", summary: "Frontend", kind: "ui", parentId: null, evidence: [] },
      { id: "root-gw", title: "Gateway", summary: "API Gateway", kind: "room", parentId: null, evidence: [] },
      { id: "api-login", title: "POST /login", summary: "Login", kind: "api", parentId: "root-gw", evidence: [] },
      { id: "api-logout", title: "POST /logout", summary: "Logout", kind: "api", parentId: "root-gw", evidence: [] },
      { id: "api-status", title: "GET /status", summary: "Status", kind: "api", parentId: "root-gw", evidence: [] },
      { id: "db-main", title: "Main DB", summary: "Database", kind: "database", parentId: null, evidence: [] },
    ];

    // Singletons in root scope should show their avatar icon
    expect(shouldShowNodeAvatar(testNodes[0]!, testNodes)).toBe(true);
    expect(shouldShowNodeAvatar(testNodes[1]!, testNodes)).toBe(true);
    expect(shouldShowNodeAvatar(testNodes[5]!, testNodes)).toBe(true);

    // Repeated API nodes in root-gw should NOT show head avatar icon
    expect(shouldShowNodeAvatar(testNodes[2]!, testNodes)).toBe(false);
    expect(shouldShowNodeAvatar(testNodes[3]!, testNodes)).toBe(false);
    expect(shouldShowNodeAvatar(testNodes[4]!, testNodes)).toBe(false);
  });
});
