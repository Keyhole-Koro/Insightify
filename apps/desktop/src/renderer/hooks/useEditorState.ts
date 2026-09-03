import { useCallback, useReducer } from "react";
import type { EdgeDraft } from "../components/EdgeManager.js";
import type { NodeDraft } from "../lib/node-draft.js";

// Which editor is open, as one value rather than three that have to agree.
//
// It was a node draft, a boolean for the edge manager, and an edge draft. Two
// things were true of those three and written down nowhere: only one editor can
// be open at a time, and an edge draft means nothing unless the edge manager is
// what is open. Both are now facts about the type — there is no state here that
// says a node is being edited inside an edge manager, so no code has to check.

export type EditorState =
  | { kind: "closed" }
  | { kind: "node"; draft: NodeDraft }
  /** The edge manager, with a form open on one edge or on none. */
  | { kind: "edges"; draft: EdgeDraft | null };

export type EditorAction =
  | { type: "editNode"; draft: NodeDraft }
  | { type: "openEdges" }
  | { type: "draftNode"; draft: NodeDraft }
  | { type: "draftEdge"; draft: EdgeDraft | null }
  | { type: "close" };

export const closedEditor: EditorState = { kind: "closed" };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "editNode":
      return { kind: "node", draft: action.draft };
    case "openEdges":
      return { kind: "edges", draft: null };
    // A draft only lands where its own editor is open, so an edit that arrives
    // after the user has closed or switched editors is dropped rather than
    // reopening what they left.
    case "draftNode":
      return state.kind === "node" ? { kind: "node", draft: action.draft } : state;
    case "draftEdge":
      return state.kind === "edges" ? { kind: "edges", draft: action.draft } : state;
    case "close":
      return closedEditor;
    default:
      return state;
  }
}

export type Editor = {
  state: EditorState;
  /** The node being edited, or null when a different editor is open. */
  nodeDraft: NodeDraft | null;
  edgesOpen: boolean;
  /** The edge being edited, or null when none is or the manager is shut. */
  edgeDraft: EdgeDraft | null;
  editNode: (draft: NodeDraft) => void;
  openEdges: () => void;
  draftNode: (draft: NodeDraft) => void;
  draftEdge: (draft: EdgeDraft | null) => void;
  close: () => void;
};

export function useEditorState(): Editor {
  const [state, dispatch] = useReducer(editorReducer, closedEditor);
  return {
    state,
    nodeDraft: state.kind === "node" ? state.draft : null,
    edgesOpen: state.kind === "edges",
    edgeDraft: state.kind === "edges" ? state.draft : null,
    editNode: useCallback((draft: NodeDraft) => dispatch({ type: "editNode", draft }), []),
    openEdges: useCallback(() => dispatch({ type: "openEdges" }), []),
    draftNode: useCallback((draft: NodeDraft) => dispatch({ type: "draftNode", draft }), []),
    draftEdge: useCallback((draft: EdgeDraft | null) => dispatch({ type: "draftEdge", draft }), []),
    close: useCallback(() => dispatch({ type: "close" }), []),
  };
}
