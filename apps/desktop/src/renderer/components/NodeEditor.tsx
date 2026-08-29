import React from "react";
import type { FlowNodeKind, FlowNodeStatus } from "@insightify/graph-domain";
import { nodeKinds } from "../lib/constants.js";
import { InlineError } from "./error/InlineError.js";

export const nodeStatuses: FlowNodeStatus[] = ["idle", "working", "ready", "error"];

export interface NodeDraft {
  nodeId: string;
  title: string;
  summary: string;
  kind: FlowNodeKind;
  evidence: string;
  tags: string;
  status: FlowNodeStatus;
  codeSnippet: string;
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

        <div className="editor-row">
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
            Status
            <select
              value={draft.status}
              onChange={(event) =>
                onChange({ ...draft, status: event.target.value as FlowNodeStatus })
              }
            >
              {nodeStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Tags (comma separated)
          <input
            value={draft.tags}
            placeholder="auth, api, database"
            onChange={(event) => onChange({ ...draft, tags: event.target.value })}
          />
        </label>

        <label>
          Code / Signature Preview (max 600 chars)
          <textarea
            className="code-input"
            value={draft.codeSnippet}
            placeholder="type User = { id: string; name: string };&#10;export async function handleAuth(req): Promise<User>"
            onChange={(event) => onChange({ ...draft, codeSnippet: event.target.value })}
          />
        </label>

        <label>
          Evidence paths (one per line)
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
