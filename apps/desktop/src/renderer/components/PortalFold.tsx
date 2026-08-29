import React from "react";
import type { PortalPreview } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";

interface PortalFoldProps {
  preview: PortalPreview;
  lod: SemanticLevel;
}

// The folded sheet: a cached miniature of the flow one level down. It is a
// summary snapshot, never a live child canvas (interaction spec 9.6, 24.2).
export function PortalFold({ preview, lod }: PortalFoldProps) {
  if (lod === "structure") {
    return (
      <div className="portal-fold collapsed">
        <i />
        {preview.childCount} folded
      </div>
    );
  }

  const at = (id: string) => preview.nodes.find((node) => node.id === id);

  return (
    <div className="portal-fold">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
        {preview.edges.map((edge) => {
          const source = at(edge.source);
          const target = at(edge.target);
          return source && target ? (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y * 0.6}
              x2={target.x}
              y2={target.y * 0.6}
            />
          ) : null;
        })}
      </svg>
      {preview.nodes.map((node) => (
        <i
          className={`fold-node${node.isEntry ? " entry" : ""}${node.isExit ? " exit" : ""}`}
          key={node.id}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          title={node.title}
        />
      ))}
      {preview.hiddenCount > 0 && <b>+{preview.hiddenCount}</b>}
      {lod === "implementation" && (
        <ol>
          {preview.nodes.slice(0, 3).map((node) => (
            <li key={node.id}>{node.title}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
