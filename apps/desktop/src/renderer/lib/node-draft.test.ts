import { describe, expect, it } from "vitest";
import type { FlowNode } from "@insightify/graph-domain";
import {
  isNodeDraftComplete,
  nodeDraftFromNode,
  nodePatchFromDraft,
  parseNodeTags,
} from "./node-draft.js";

const node: FlowNode = {
  id: "router",
  title: "REST router",
  summary: "Routes REST traffic",
  kind: "api",
  parentId: "gateway",
  evidence: ["src/router.ts", "src/routes/index.ts"],
  tags: ["rest", "http"],
  status: "ready",
  technology: "Express",
  codeSnippet: "app.use(router)",
};

describe("nodeDraftFromNode", () => {
  it("flattens list fields into editable text", () => {
    expect(nodeDraftFromNode(node)).toMatchObject({
      evidence: "src/router.ts\nsrc/routes/index.ts",
      tags: "rest, http",
      status: "ready",
    });
  });

  it("presents missing optional fields as empty strings, not undefined", () => {
    const bare: FlowNode = { id: "store", title: "Store", summary: "Keeps data", kind: "database", parentId: null, evidence: [] };
    expect(nodeDraftFromNode(bare)).toMatchObject({ technology: "", tags: "", codeSnippet: "", status: "idle" });
  });
});

describe("parseNodeTags", () => {
  it("trims, strips a leading hash and drops blanks", () => {
    expect(parseNodeTags(" #rest ,, http , ")).toEqual(["rest", "http"]);
  });

  it("keeps at most six tags", () => {
    expect(parseNodeTags("a,b,c,d,e,f,g,h")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("nodePatchFromDraft", () => {
  it("round-trips a node through the editor unchanged", () => {
    const patch = nodePatchFromDraft(nodeDraftFromNode(node));
    expect(patch).toMatchObject({
      title: node.title,
      summary: node.summary,
      kind: node.kind,
      evidence: node.evidence,
      tags: node.tags,
      technology: node.technology,
      codeSnippet: node.codeSnippet,
      status: node.status,
    });
  });

  it("drops emptied optional fields instead of storing blanks", () => {
    const patch = nodePatchFromDraft({
      ...nodeDraftFromNode(node),
      technology: "  ",
      tags: " , ",
      codeSnippet: "",
    });
    expect(patch.technology).toBeUndefined();
    expect(patch.tags).toBeUndefined();
    expect(patch.codeSnippet).toBeUndefined();
  });
});

describe("isNodeDraftComplete", () => {
  it("requires a title and a summary", () => {
    const draft = nodeDraftFromNode(node);
    expect(isNodeDraftComplete(draft)).toBe(true);
    expect(isNodeDraftComplete({ ...draft, title: "   " })).toBe(false);
    expect(isNodeDraftComplete({ ...draft, summary: "" })).toBe(false);
  });
});
