import React from "react";
import type { FlowNodeKind } from "@insightify/graph-domain";
import { nodeKinds } from "../lib/constants.js";
import { InlineError } from "./error/InlineError.js";

export interface NodeDraft {
  nodeId: string;
  title: string;
  summary: string;
  kind: FlowNodeKind;
  evidence: string;
}

interface NodeEditorProps {
  draft: NodeDraft;
  onChange: (value: NodeDraft) => void;
  onSave: () => void;
  onDelete: (() => void) | null;
  onClose: () => void;
}

export function NodeEditor({ draft, onChange, onSave, onDelete, onClose }: NodeEditorProps) {
  const isTitleEmpty = !draft.title.trim();
  const isSummaryEmpty = !draft.summary.trim();

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="editor-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <header>
          <div>
            <span>EDIT NODE</span>
            <h2>{draft.title || "Untitled Node"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </header>

        <label>
          Title
          <input
            autoFocus
            value={draft.title}
            maxLength={60}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            placeholder="Node title"
          />
          {isTitleEmpty && <InlineError message="タイトルは必須です" />}
        </label>

        <label>
          Summary
          <textarea
            value={draft.summary}
            maxLength={240}
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            placeholder="What does this node represent in the flow?"
          />
          {isSummaryEmpty && <InlineError message="サマリーは必須です" />}
        </label>

        <label>
          Kind
          <select
            value={draft.kind}
            onChange={(event) =>
              onChange({ ...draft, kind: event.target.value as FlowNodeKind })
            }
          >
            {nodeKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label>
          Evidence paths
          <textarea
            className="evidence-input"
            value={draft.evidence}
            placeholder="src/main.ts&#10;docs/design.md"
            onChange={(event) => onChange({ ...draft, evidence: event.target.value })}
          />
        </label>

        <footer>
          {onDelete ? (
            <button type="button" className="danger-button" onClick={onDelete}>
              Delete node
            </button>
          ) : (
            <span />
          )}
          <div>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={isTitleEmpty || isSummaryEmpty}
              type="submit"
            >
              Save node
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
