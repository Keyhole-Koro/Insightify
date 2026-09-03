import { describe, expect, it } from "vitest";
import { FLOW_GRAPH_JSON_SCHEMA, parseFlowGraph } from "./index.js";

const implementation = {
  entrypoint: "verifySession",
  source: { path: "src/guard.ts", symbol: "verifySession", startLine: 12, endLine: 48 },
  steps: [
    {
      id: "validate-token",
      title: "Validate the token",
      summary: "Rejects malformed or expired bearer tokens.",
      kind: "condition" as const,
      inputs: ["bearer token"],
      outputs: ["verified claims"],
      children: [
        {
          id: "verify-signature",
          title: "Verify signature",
          summary: "Checks the token against the current signing key.",
          kind: "call" as const,
        },
      ],
    },
    {
      id: "return-session",
      title: "Return the session",
      summary: "Returns the authenticated user and roles.",
      kind: "return" as const,
    },
  ],
};

function graphWith(candidate: unknown) {
  return {
    title: "Authentication",
    summary: "Authentication flow",
    nodes: [{
      id: "auth-guard",
      title: "Auth guard",
      summary: "Verifies a session",
      kind: "auth" as const,
      parentId: null,
      evidence: ["src/guard.ts"],
      implementation: candidate,
    }],
    edges: [],
  };
}

describe("implementation outline", () => {
  it("accepts a bounded semantic explanation tree", () => {
    expect(parseFlowGraph(graphWith(implementation)).nodes[0]?.implementation).toEqual(implementation);
  });

  it("rejects duplicate ids across phases and substeps", () => {
    const duplicate = {
      ...implementation,
      steps: [
        implementation.steps[0]!,
        { ...implementation.steps[1]!, id: "verify-signature" },
      ],
    };
    expect(() => parseFlowGraph(graphWith(duplicate))).toThrow(/Duplicate implementation step id/);
  });

  it("requires every source path to be grounded in node evidence", () => {
    const ungrounded = { ...implementation, source: { path: "src/invented.ts" } };
    expect(() => parseFlowGraph(graphWith(ungrounded))).toThrow(/must also appear in evidence/);
  });

  it("exposes the outline to providers without recursive JSON Schema references", () => {
    const schema = FLOW_GRAPH_JSON_SCHEMA as any;
    const node = schema.properties.nodes.items;
    expect(node.properties.implementation).toBeDefined();
    expect(JSON.stringify(node.properties.implementation)).not.toContain("$ref");
  });
});
