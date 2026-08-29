import React from "react";
import type { FlowEdge, FlowNode } from "@insightify/graph-domain";
import { nodeTitle } from "../lib/flowfold-helpers.js";

export interface EdgeDraft {
  index: number | null;
  source: string;
  target: string;
  label: string;
}

interface EdgeManagerProps {
  nodes: FlowNode[];
  edges: Array<{ edge: FlowEdge; index: number }>;
  draft: EdgeDraft | null;
  onDraft: (value: EdgeDraft | null) => void;
  onNew: () => void;
  onSave: () => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

export function EdgeManager({
  nodes,
  edges,
  draft,
  onDraft,
  onNew,
  onSave,
  onDelete,
  onClose,
}: EdgeManagerProps) {
  return (
    <aside className="edge-manager" aria-label="Edge connections manager">
      <header>
        <div>
          <span>ROOM EDGES</span>
          <h2>Connections</h2>
        </div>
        <button onClick={onClose} type="button" aria-label="Close edge manager">
          ×
        </button>
      </header>
      <div className="edge-list">
        {edges.length === 0 && <p>No edges in this Room.</p>}
        {edges.map(({ edge, index }) => (
          <button
            className={draft?.index === index ? "selected" : ""}
            key={index}
            onClick={() => onDraft({ index, ...edge })}
            type="button"
          >
            <b>
              {nodeTitle(nodes, edge.source)} → {nodeTitle(nodes, edge.target)}
            </b>
            <span>{edge.label || "Unlabelled flow"}</span>
          </button>
        ))}
      </div>
      {draft ? (
        <div className="edge-form">
          <label>
            From
            <select
              value={draft.source}
              onChange={(event) => onDraft({ ...draft, source: event.target.value })}
            >
              {nodes.map((node) => (
                <option value={node.id} key={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={draft.target}
              onChange={(event) => onDraft({ ...draft, target: event.target.value })}
            >
              {nodes.map((node) => (
                <option value={node.id} key={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input
              maxLength={60}
              value={draft.label}
              onChange={(event) => onDraft({ ...draft, label: event.target.value })}
              placeholder="Edge description"
            />
          </label>
          <div>
            {draft.index !== null && (
              <button
                className="danger-button"
                onClick={() => onDelete(draft.index!)}
                type="button"
              >
                Delete
              </button>
            )}
            <button className="primary-button" onClick={onSave} type="button">
              Save edge
            </button>
          </div>
        </div>
      ) : (
        <button className="primary-button new-edge" onClick={onNew} type="button">
          ＋ New edge
        </button>
      )}
    </aside>
  );
}
