import { describe, expect, it } from "vitest";
import {
  applyScopeExpansion,
  balanceFlowGraphScopes,
  buildPortalPreview,
  createDefaultGraphLayout,
  generatedFlowGraphSchema,
  getExpandedRoomFrames,
  layoutFlowNodes,
  layoutFlowNodesWithExpandedScopes,
  layoutRootNodes,
  mergeSemanticLayoutScopes,
  parseFlowGraph,
  parseFlowGraphExpansion,
  projectFlowToScope,
  projectFlowWithExpandedScopes,
  resolveRoomLayoutRules,
  scopeBoundaryPorts,
  defaultRoomLayoutRules,
  semanticLayoutPlanSchema,
  semanticScopeLayoutSchema,
  validateScopeExpansion,
} from "./index.js";

const graph = {
  title: "System",
  summary: "A small system",
  nodes: [
    { id: "input", title: "Input", summary: "Accept input", kind: "process", parentId: null, evidence: ["src/input.ts"] },
    { id: "output", title: "Output", summary: "Return output", kind: "process", parentId: null, evidence: ["src/output.ts"] },
  ],
  edges: [{ source: "input", target: "output", label: "passes data" }],
} as const;

describe("flowGraphSchema", () => {
  it("accepts a referenced graph", () => {
    expect(parseFlowGraph(graph).nodes).toHaveLength(2);
  });

  it("rejects edges to unknown nodes", () => {
    expect(() => parseFlowGraph({ ...graph, edges: [{ source: "input", target: "missing", label: "bad" }] })).toThrow();
  });
});

describe("layoutRootNodes", () => {
  it("places visible nodes deterministically", () => {
    expect(layoutRootNodes(parseFlowGraph(graph)).map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "input", x: 15, y: 50 },
      { id: "output", x: 85, y: 50 },
    ]);
  });

  it("lays out an arbitrary nested scope", () => {
    expect(layoutFlowNodes(parseFlowGraph(graph).nodes).map((node) => node.id)).toEqual(["input", "output"]);
  });

  it("uses edge direction instead of input order", () => {
    const parsed = parseFlowGraph(graph);
    const positions = layoutFlowNodes([...parsed.nodes].reverse(), parsed.edges);
    expect(positions.find((node) => node.id === "input")!.x).toBeLessThan(positions.find((node) => node.id === "output")!.x);
  });
});

describe("scope projection", () => {
  const nested = parseFlowGraph({
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: "parse", title: "Parse", summary: "Parse input", kind: "process", parentId: "input", evidence: [] },
      { id: "validate", title: "Validate", summary: "Validate input", kind: "decision", parentId: "input", evidence: [] },
    ],
    edges: [
      { source: "output", target: "parse", label: "request" },
      { source: "parse", target: "validate", label: "parsed" },
      { source: "validate", target: "output", label: "result" },
    ],
  });

  it("keeps flow continuity at Room boundaries", () => {
    const projection = projectFlowToScope(nested, "input");
    expect(projection.nodes.map((node) => node.id)).toEqual(["parse", "validate"]);
    expect(projection.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: null, target: "parse", count: 1 }),
      expect.objectContaining({ source: "parse", target: "validate", count: 1 }),
      expect.objectContaining({ source: "validate", target: null, count: 1 }),
    ]));
  });

  it("bundles descendant edges at their visible Portal", () => {
    const projection = projectFlowToScope(nested, null);
    expect(projection.edges).toEqual([
      expect.objectContaining({ source: "output", target: "input", count: 1 }),
      expect.objectContaining({ source: "input", target: "output", count: 1 }),
    ]);
  });
});

describe("Room density", () => {
  it("keeps unlimited total nodes while folding each Room to seven Portals", () => {
    const many = parseFlowGraph({
      ...graph,
      nodes: Array.from({ length: 18 }, (_, index) => ({ id: `node-${index}`, title: `Node ${index}`, summary: "Step", kind: "process" as const, parentId: null, evidence: [] })),
      edges: [],
    });
    const balanced = balanceFlowGraphScopes(many);
    expect(balanced.nodes.length).toBeGreaterThan(18);
    const parentIds = new Set<string | null>([null, ...balanced.nodes.map((node) => node.parentId)]);
    for (const parentId of parentIds) {
      expect(balanced.nodes.filter((node) => node.parentId === parentId).length).toBeLessThanOrEqual(7);
    }
  });
});

describe("generatedFlowGraphSchema", () => {
  it("validates persisted manual layout coordinates", () => {
    expect(generatedFlowGraphSchema.parse({
      projectId: "55f8b65b-0919-4f86-81a5-1fdb137bb69f",
      provider: "codex",
      snapshotHash: "snapshot",
      generatedAt: "2026-08-29T00:00:00.000Z",
      graph,
      layout: { input: { x: 20, y: 30 } },
    }).layout.input.x).toBe(20);
  });
});

describe("semantic layout plans", () => {
  const plan = semanticLayoutPlanSchema.parse({
    version: 1,
    scopes: [{
      roomId: null,
      direction: "row",
      areas: [
        { id: "ingress", label: "Ingress", direction: "column", nodeIds: ["input"] },
        { id: "egress", label: "Egress", direction: "column", nodeIds: ["output"] },
      ],
    }],
  });

  it("compiles exact node membership into deterministic Area DSL rules", () => {
    const parsed = parseFlowGraph(graph);
    const rules = resolveRoomLayoutRules(parsed, plan);
    expect(rules[0]).toMatchObject({
      roomId: null,
      area: {
        direction: "row",
        splitRatio: [1, 1],
        subAreas: [
          { name: "Ingress", match: { nodeIds: ["input"] } },
          { name: "Egress", match: { nodeIds: ["output"] } },
        ],
      },
    });
    const positioned = layoutRootNodes(parsed, rules);
    expect(positioned.find((node) => node.id === "input")!.x)
      .toBeLessThan(positioned.find((node) => node.id === "output")!.x);
  });

  it("ignores unknown members instead of allowing a bad plan to break layout", () => {
    const parsed = parseFlowGraph(graph);
    const invalid = semanticLayoutPlanSchema.parse({
      version: 1,
      scopes: [{
        roomId: null,
        direction: "row",
        areas: [{ id: "missing", label: "Missing", direction: "grid", nodeIds: ["unknown"] }],
      }],
    });
    expect(resolveRoomLayoutRules(parsed, invalid)).toEqual(defaultRoomLayoutRules);
  });

  it("limits an expansion patch to the requested Room", () => {
    const expanded = parseFlowGraph({
      ...graph,
      nodes: [
        { id: "gateway", title: "Gateway", summary: "Gateway room", kind: "room", parentId: null, evidence: [] },
        { id: "route", title: "Route", summary: "Route request", kind: "api", parentId: "gateway", evidence: [] },
      ],
      edges: [],
    });
    const gatewayScope = semanticScopeLayoutSchema.parse({
      roomId: "gateway",
      direction: "column",
      areas: [{ id: "routing", label: "Routing", direction: "row", nodeIds: ["route"] }],
    });
    const merged = mergeSemanticLayoutScopes(
      expanded,
      plan,
      [gatewayScope],
      new Set(["gateway"])
    );
    expect(merged.scopes.map((scope) => scope.roomId)).toEqual([null, "gateway"]);
    expect(() => mergeSemanticLayoutScopes(expanded, plan, [gatewayScope], new Set(["other"])))
      .toThrow("did not describe the expanded Room");
  });
});

describe("scope expansion", () => {
  it("merges append-only patches without a global node limit", () => {
    const current = parseFlowGraph(graph);
    const nodes = Array.from({ length: 20 }, (_, index) => ({ id: `detail-${index}`, title: `Detail ${index}`, summary: "Nested detail", kind: "process" as const, parentId: "input", evidence: [] }));
    const expansion = parseFlowGraphExpansion({ nodes, edges: [{ source: "detail-0", target: "output", label: "boundary" }] });
    expect(applyScopeExpansion(current, expansion, "input").nodes).toHaveLength(22);
  });

  it("rejects a patch edge unrelated to every generated node", () => {
    const current = parseFlowGraph(graph);
    const expansion = parseFlowGraphExpansion({
      nodes: [{ id: "detail", title: "Detail", summary: "Nested detail", kind: "process", parentId: "input", evidence: [] }],
      edges: [{ source: "output", target: "input", label: "unrelated" }],
    });
    expect(() => applyScopeExpansion(current, expansion, "input")).toThrow("unrelated edge");
  });

  it("preserves existing nodes and only adds descendants of the requested Room", () => {
    const current = parseFlowGraph(graph);
    const expanded = parseFlowGraph({ ...graph, nodes: [...graph.nodes, { id: "detail", title: "Detail", summary: "Nested detail", kind: "process", parentId: "input", evidence: [] }] });
    expect(validateScopeExpansion(current, expanded, "input").nodes).toHaveLength(3);
    expect(createDefaultGraphLayout(expanded)).toHaveProperty("detail");
  });

  it("rejects an expansion that rewrites an existing node", () => {
    const current = parseFlowGraph(graph);
    const expanded = parseFlowGraph({ ...graph, nodes: [{ ...graph.nodes[0], title: "Rewritten" }, graph.nodes[1], { id: "detail", title: "Detail", summary: "Nested detail", kind: "process", parentId: "input", evidence: [] }] });
    expect(() => validateScopeExpansion(current, expanded, "input")).toThrow("changed existing node");
  });

  it("allows a generated child to connect to an existing boundary node", () => {
    const current = parseFlowGraph(graph);
    const expanded = parseFlowGraph({
      ...graph,
      nodes: [...graph.nodes, { id: "detail", title: "Detail", summary: "Nested detail", kind: "process", parentId: "input", evidence: [] }],
      edges: [...graph.edges, { source: "input", target: "detail", label: "crosses scope" }],
    });
    expect(validateScopeExpansion(current, expanded, "input").edges).toHaveLength(2);
  });

  it("rejects an unrelated new edge between existing nodes", () => {
    const current = parseFlowGraph(graph);
    const expanded = parseFlowGraph({
      ...graph,
      nodes: [...graph.nodes, { id: "detail", title: "Detail", summary: "Nested detail", kind: "process", parentId: "input", evidence: [] }],
      edges: [...graph.edges, { source: "output", target: "input", label: "unrelated" }],
    });
    expect(() => validateScopeExpansion(current, expanded, "input")).toThrow("unrelated edge");
  });
});

describe("scope boundary ports", () => {
  const nested = parseFlowGraph({
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: "parse", title: "Parse", summary: "Parse input", kind: "process", parentId: "input", evidence: [] },
      { id: "validate", title: "Validate", summary: "Validate input", kind: "decision", parentId: "input", evidence: [] },
    ],
    edges: [
      { source: "output", target: "parse", label: "request" },
      { source: "parse", target: "validate", label: "parsed" },
      { source: "validate", target: "output", label: "result" },
    ],
  });

  it("names the node on the other side of the Room wall", () => {
    expect(scopeBoundaryPorts(nested, "input")).toEqual([
      { side: "input", nodeId: "parse", count: 1, endpoints: [{ id: "output", title: "Output", label: "request" }] },
      { side: "output", nodeId: "validate", count: 1, endpoints: [{ id: "output", title: "Output", label: "result" }] },
    ]);
  });

  it("keeps an edge that ends at the Room node itself", () => {
    const deep = parseFlowGraph({
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: "stage", title: "Stage", summary: "A nested stage", kind: "room", parentId: "input", evidence: [] },
        { id: "first", title: "First", summary: "Opens the stage", kind: "process", parentId: "stage", evidence: [] },
        { id: "last", title: "Last", summary: "Closes the stage", kind: "process", parentId: "stage", evidence: [] },
      ],
      edges: [
        { source: "output", target: "stage", label: "request" },
        { source: "first", target: "last", label: "step" },
        { source: "stage", target: "output", label: "result" },
      ],
    });
    expect(scopeBoundaryPorts(deep, "stage")).toEqual([
      { side: "input", nodeId: "first", count: 1, endpoints: [{ id: "output", title: "Output", label: "request" }] },
      { side: "output", nodeId: "last", count: 1, endpoints: [{ id: "output", title: "Output", label: "result" }] },
    ]);
  });

  it("has no boundary at the root scope", () => {
    expect(scopeBoundaryPorts(nested, null)).toEqual([]);
  });
});

describe("portal preview", () => {
  const withChildren = parseFlowGraph({
    ...graph,
    nodes: [
      ...graph.nodes,
      ...Array.from({ length: 6 }, (_unused, index) => ({
        id: `step-${index}`,
        title: `Step ${index}`,
        summary: "A step",
        kind: "process" as const,
        parentId: "input",
        evidence: [],
      })),
    ],
    edges: [
      ...graph.edges,
      ...Array.from({ length: 5 }, (_unused, index) => ({ source: `step-${index}`, target: `step-${index + 1}`, label: "" })),
      { source: "step-5", target: "output", label: "done" },
    ],
  });

  it("shows a bounded miniature of the flow inside a Portal", () => {
    const preview = buildPortalPreview(withChildren, "input");
    expect(preview.childCount).toBe(6);
    expect(preview.descendantCount).toBe(6);
    expect(preview.nodes).toHaveLength(5);
    expect(preview.hiddenCount).toBe(1);
    expect(preview.nodes.map((node) => node.id)).toEqual(["step-0", "step-1", "step-2", "step-3", "step-4"]);
    expect(preview.edges).toHaveLength(4);
    expect(preview.nodes.every((node) => node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100)).toBe(true);
  });

  it("marks where the inner flow crosses the Portal wall", () => {
    const preview = buildPortalPreview(withChildren, "input");
    expect(preview.nodes.find((node) => node.id === "step-0")!.isExit).toBe(false);
    expect(buildPortalPreview(withChildren, "output")).toEqual({ nodes: [], edges: [], childCount: 0, descendantCount: 0, hiddenCount: 0 });
  });
});

describe("layoutNodesWithAreaDSL", () => {
  it("organizes API endpoints vertically in left column and other services on right", () => {
    const apiNodes = [
      { id: "api-login", title: "POST /login", summary: "Auth login", kind: "api" as const, parentId: "api-gateway", evidence: [] },
      { id: "api-get", title: "GET /workflows", summary: "Get flows", kind: "api" as const, parentId: "api-gateway", evidence: [] },
      { id: "api-exec", title: "POST /execute", summary: "Run flow", kind: "api" as const, parentId: "api-gateway", evidence: [] },
      { id: "api-stream", title: "POST /synthesize", summary: "Stream tokens", kind: "api" as const, parentId: "api-gateway", tags: ["stream", "openai"], evidence: [] },
      { id: "api-gql", title: "POST /graphql", summary: "GraphQL", kind: "api" as const, parentId: "api-gateway", tags: ["graphql"], evidence: [] },
    ];

    const positioned = layoutFlowNodes(apiNodes, [], "api-gateway");
    expect(positioned).toHaveLength(5);

    // REST endpoints should be in the left column (x around 20-35%), stream/graphql in right column (x around 65-80%)
    const loginNode = positioned.find((n) => n.id === "api-login")!;
    const streamNode = positioned.find((n) => n.id === "api-stream")!;

    expect(loginNode.x).toBeLessThan(streamNode.x);
    expect(loginNode.y).toBeGreaterThan(0);
    expect(loginNode.y).toBeLessThan(100);
  });
});

describe("projectFlowWithExpandedScopes", () => {
  it("inlines child nodes when a Room is expanded without entering it", () => {
    const testGraph = parseFlowGraph({
      title: "Inline expansion test",
      summary: "Test graph",
      nodes: [
        { id: "root-ui", title: "Web UI", summary: "Client", kind: "ui", parentId: null, evidence: [] },
        { id: "root-gw", title: "API Gateway", summary: "Gateway", kind: "room", parentId: null, evidence: [] },
        { id: "child-api-1", title: "POST /auth", summary: "Auth endpoint", kind: "api", parentId: "root-gw", evidence: [] },
        { id: "child-api-2", title: "GET /data", summary: "Data endpoint", kind: "api", parentId: "root-gw", evidence: [] },
      ],
      edges: [
        { source: "root-ui", target: "child-api-1", label: "request" },
      ],
    });

    // 1. When not expanded, only root nodes are visible
    const collapsed = projectFlowWithExpandedScopes(testGraph, null, new Set());
    expect(collapsed.nodes.map((n) => n.id)).toEqual(["root-ui", "root-gw"]);
    expect(collapsed.edges[0]?.target).toBe("root-gw");

    // 2. When root-gw is expanded inline, its children are visible simultaneously in root scope
    const expanded = projectFlowWithExpandedScopes(testGraph, null, new Set(["root-gw"]));
    expect(expanded.nodes.map((n) => n.id)).toEqual(["root-ui", "root-gw", "child-api-1", "child-api-2"]);
    expect(expanded.edges[0]?.target).toBe("child-api-1");
  });

  it("fits a Room to its lane structure and reflows a nearby sibling", () => {
    const testGraph = parseFlowGraph({
      title: "Adaptive inline expansion",
      summary: "A two-lane API Room beside an auth node",
      nodes: [
        { id: "api-gateway", title: "API Gateway", summary: "Gateway", kind: "room", parentId: null, evidence: [] },
        { id: "auth-guard", title: "Auth Guard", summary: "Guard", kind: "auth", parentId: null, evidence: [] },
        { id: "api-auth-login", title: "POST /login", summary: "Login", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-workflows-create", title: "POST /workflows", summary: "Create", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-workflows-get", title: "GET /workflows", summary: "Read", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-workflows-run", title: "POST /run", summary: "Run", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-ai-synthesize", title: "POST /ai", summary: "Stream", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-stripe-webhook", title: "POST /stripe", summary: "Webhook", kind: "api", parentId: "api-gateway", evidence: [] },
        { id: "api-graphql", title: "POST /graphql", summary: "GraphQL", kind: "api", parentId: "api-gateway", evidence: [] },
      ],
      edges: [],
    });
    const openRooms = new Set(["api-gateway"]);
    const projection = projectFlowWithExpandedScopes(testGraph, null, openRooms);
    const savedLayout = {
      "api-gateway": { x: 30, y: 50 },
      "auth-guard": { x: 48, y: 50 },
    };
    // Two lanes inside the Room, expressed the way a generated graph expresses
    // them: as a semantic plan naming its own nodes.
    const rules = resolveRoomLayoutRules(
      testGraph,
      semanticLayoutPlanSchema.parse({
        version: 1,
        scopes: [{
          roomId: "api-gateway",
          direction: "row",
          areas: [
            {
              id: "rest",
              label: "REST lane",
              direction: "column",
              nodeIds: ["api-auth-login", "api-workflows-create", "api-workflows-get", "api-workflows-run"],
            },
            {
              id: "async",
              label: "Async lane",
              direction: "column",
              nodeIds: ["api-ai-synthesize", "api-stripe-webhook", "api-graphql"],
            },
          ],
        }],
      })
    );
    const [frame] = getExpandedRoomFrames(
      projection.nodes,
      null,
      openRooms,
      [],
      savedLayout,
      rules
    );
    const layout = layoutFlowNodesWithExpandedScopes(
      projection.nodes,
      null,
      openRooms,
      [],
      savedLayout,
      rules
    );
    const auth = layout.find((node) => node.id === "auth-guard")!;
    const children = layout.filter((node) => node.parentId === "api-gateway");

    expect(frame).toMatchObject({ childCount: 7, columns: 2, rows: 4 });
    expect(frame!.bounds).toMatchObject({ width: 18.5, height: 22 });
    expect(auth.x).toBeGreaterThanOrEqual(frame!.bounds.x + frame!.bounds.width + 7);
    expect(children.every((node) =>
      node.x >= frame!.contentBounds.x &&
      node.x <= frame!.contentBounds.x + frame!.contentBounds.width &&
      node.y >= frame!.contentBounds.y &&
      node.y <= frame!.contentBounds.y + frame!.contentBounds.height
    )).toBe(true);
  });

  it("treats a customized child position as local to its expanded Room", () => {
    const testGraph = parseFlowGraph({
      title: "Local child drag",
      summary: "Persist a child inside its group",
      nodes: [
        { id: "root-room", title: "Room", summary: "Container", kind: "room", parentId: null, evidence: [] },
        { id: "child-one", title: "One", summary: "First", kind: "process", parentId: "root-room", evidence: [] },
        { id: "child-two", title: "Two", summary: "Second", kind: "process", parentId: "root-room", evidence: [] },
      ],
      edges: [{ source: "child-one", target: "child-two", label: "next" }],
    });
    const openRooms = new Set(["root-room"]);
    const projection = projectFlowWithExpandedScopes(testGraph, null, openRooms);
    const savedLayout = {
      "root-room": { x: 50, y: 50 },
      "child-one": { x: 90, y: 12 },
    };
    const [frame] = getExpandedRoomFrames(projection.nodes, null, openRooms, [], savedLayout);
    const layout = layoutFlowNodesWithExpandedScopes(
      projection.nodes,
      null,
      openRooms,
      [],
      savedLayout
    );
    const child = layout.find((node) => node.id === "child-one")!;

    expect(child.x).toBeCloseTo(frame!.contentBounds.x + frame!.contentBounds.width * 0.9, 1);
    expect(child.y).toBeCloseTo(frame!.contentBounds.y + frame!.contentBounds.height * 0.12, 1);
  });
});
