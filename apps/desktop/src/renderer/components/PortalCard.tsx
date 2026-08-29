import React, { type PointerEvent as ReactPointerEvent } from "react";
import type { FlowNode, PortalPreview } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";
import { kindIcon } from "../lib/flowfold-helpers.js";
import { PortalFold } from "./PortalFold.js";

interface PortalCardProps {
  node: FlowNode & { x: number; y: number };
  preview: PortalPreview;
  lod: SemanticLevel;
  selected: boolean;
  connections: { input: boolean; output: boolean };
  onSelect: () => void;
  onPeek: () => void;
  onEnter: () => void;
  onEdit: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function PortalCard({
  node,
  preview,
  lod,
  selected,
  connections,
  onSelect,
  onPeek,
  onEnter,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: PortalCardProps) {
  const isPortal = preview.childCount > 0;

  return (
    <article
      aria-label={`${node.title}. ${node.kind}. ${
        isPortal ? `Portal containing ${preview.descendantCount} nodes` : "No inner flow yet"
      }`}
      className={`portal-card${selected ? " selected" : ""}${isPortal ? " is-portal" : ""}`}
      role="button"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onEnter}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span
        className={connections.input ? "card-port in connected" : "card-port in"}
        aria-hidden="true"
      />
      <span
        className={connections.output ? "card-port out connected" : "card-port out"}
        aria-hidden="true"
      />
      <div className="portal-header">
        <span className="portal-icon">{kindIcon(node.kind)}</span>
        <span className="node-kind">{node.kind}</span>
        <span className="status-dot" />
      </div>
      <h2>{node.title}</h2>
      {lod !== "structure" && <p className="portal-summary">{node.summary}</p>}
      {isPortal && <PortalFold preview={preview} lod={lod} />}
      {lod === "implementation" && (
        <div className="portal-evidence">{node.evidence[0] ?? "No evidence link"}</div>
      )}
      {lod !== "structure" && (
        <div className="portal-footer">
          <span>
            {isPortal
              ? `${preview.childCount} inside · ${preview.descendantCount} deep`
              : "no inner flow"}
          </span>
          <div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onPeek();
              }}
              type="button"
            >
              Peek
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEnter();
              }}
              type="button"
            >
              Enter
            </button>
            <button
              aria-label={`Edit ${node.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              type="button"
            >
              •••
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
