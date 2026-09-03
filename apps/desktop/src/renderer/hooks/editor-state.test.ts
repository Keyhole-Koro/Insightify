import { describe, expect, it } from "vitest";
import { closedEditor, editorReducer, type EditorState } from "./useEditorState.js";
import type { NodeDraft } from "../lib/node-draft.js";
import type { EdgeDraft } from "../components/EdgeManager.js";

const nodeDraft: NodeDraft = {
  nodeId: "alpha",
  title: "Alpha",
  summary: "A node",
  kind: "service",
  technology: "",
  evidence: "",
  tags: "",
  status: "idle",
  codeSnippet: "",
};
const edgeDraft: EdgeDraft = { index: null, source: "alpha", target: "beta", label: "" };
const run = (state: EditorState, ...actions: Parameters<typeof editorReducer>[1][]) =>
  actions.reduce(editorReducer, state);

// The point of holding these three as one value is that the combinations that
// used to be possible no longer are. These are those combinations.
describe("editorReducer", () => {
  it("opens one editor at a time", () => {
    const state = run(closedEditor, { type: "editNode", draft: nodeDraft }, { type: "openEdges" });
    expect(state).toEqual({ kind: "edges", draft: null });
  });

  it("cannot hold an edge draft unless the edge manager is what is open", () => {
    const state = run(closedEditor, { type: "draftEdge", draft: edgeDraft });
    expect(state).toEqual(closedEditor);
  });

  it("cannot hold a node draft while the edge manager is open", () => {
    const state = run(closedEditor, { type: "openEdges" }, { type: "draftNode", draft: nodeDraft });
    expect(state).toEqual({ kind: "edges", draft: null });
  });

  it("keeps the edge manager open when its form is cleared", () => {
    const state = run(
      closedEditor,
      { type: "openEdges" },
      { type: "draftEdge", draft: edgeDraft },
      { type: "draftEdge", draft: null }
    );
    expect(state).toEqual({ kind: "edges", draft: null });
  });

  it("closes whatever was open", () => {
    expect(run(closedEditor, { type: "editNode", draft: nodeDraft }, { type: "close" }))
      .toEqual(closedEditor);
    expect(run(closedEditor, { type: "openEdges" }, { type: "close" })).toEqual(closedEditor);
  });

  it("edits the draft of the editor that is open", () => {
    const state = run(
      closedEditor,
      { type: "editNode", draft: nodeDraft },
      { type: "draftNode", draft: { ...nodeDraft, title: "Renamed" } }
    );
    expect(state).toEqual({ kind: "node", draft: { ...nodeDraft, title: "Renamed" } });
  });
});
