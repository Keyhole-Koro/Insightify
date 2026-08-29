import React, { useState, type PointerEvent as ReactPointerEvent } from "react";
import type { FlowNode, PortalPreview } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";
import { copyToClipboard } from "../lib/clipboard.js";
import { NodeIcon } from "./NodeIcon.js";
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
  onAskAi?: () => void;
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
  onAskAi,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: PortalCardProps) {
  const isPortal = preview.childCount > 0;
  const [copied, setCopied] = useState(false);

  const status = node.status ?? (preview.childCount > 0 ? "ready" : "idle");
  const tech = node.technology || node.tags?.find((t) => /aws|gcp|azure|docker|k8s|postgres|redis|openai|stripe/i.test(t));

  async function handleCopy(event: React.MouseEvent) {
    event.stopPropagation();
    const content = [
      `[Node: ${node.title}] (${node.kind}${tech ? ` · ${tech}` : ""})`,
      node.summary,
      node.tags?.length ? `Tags: ${node.tags.map((t) => `#${t}`).join(" ")}` : "",
      node.evidence.length ? `Evidence: ${node.evidence.join(", ")}` : "",
      node.codeSnippet ? `\nCode:\n${node.codeSnippet}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <article
      aria-label={`${node.title}. ${node.kind}. ${
        isPortal ? `Portal containing ${preview.descendantCount} nodes` : "No inner flow yet"
      }`}
      className={`portal-card kind-${node.kind} status-${status}${selected ? " selected" : ""}${
        isPortal ? " is-portal" : ""
      }${tech ? ` tech-${tech.toLowerCase()}` : ""}`}
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
      {/* Ports */}
      <span
        className={connections.input ? "card-port in connected" : "card-port in"}
        aria-hidden="true"
      />
      <span
        className={connections.output ? "card-port out connected" : "card-port out"}
        aria-hidden="true"
      />

      {/* Kind-specific top ornamentation */}
      {node.kind === "ui" && (
        <div className="card-window-bar">
          <i />
          <i />
          <i />
        </div>
      )}
      {node.kind === "database" && <div className="card-cylinder-rim" />}
      {node.kind === "api" && (
        <div className="card-api-badge">
          <span>{node.title.startsWith("POST") ? "POST" : node.title.startsWith("DELETE") ? "DEL" : "GET"}</span>
          <em>API</em>
        </div>
      )}

      {/* Header */}
      <div className="portal-header">
        <span className="portal-icon">
          <NodeIcon kind={node.kind} technology={tech} size={15} />
        </span>
        <span className="node-kind">{tech || node.kind}</span>
        <div className="portal-header-actions">
          <button
            className={`copy-chip ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="ノード情報をクリップボードにコピー"
            type="button"
          >
            {copied ? "Copied! ✓" : "📋 Copy"}
          </button>
          <span className={`status-dot status-${status}`} title={`Status: ${status}`} />
        </div>
      </div>

      {/* Title & Tags */}
      <h2>{node.title}</h2>

      {node.tags && node.tags.length > 0 && lod !== "structure" && (
        <div className="portal-tags">
          {node.tags.map((tag) => (
            <span key={tag} className="portal-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      {lod !== "structure" && <p className="portal-summary">{node.summary}</p>}

      {/* Code Snippet / Signature (in implementation LOD) */}
      {lod === "implementation" && node.codeSnippet && (
        <div className="portal-code-preview">
          <code>{node.codeSnippet}</code>
        </div>
      )}

      {/* Folded Sheet (miniature of inner flow) */}
      {isPortal && <PortalFold preview={preview} lod={lod} />}

      {/* Evidence */}
      {lod === "implementation" && node.evidence.length > 0 && (
        <div
          className="portal-evidence"
          title="クリックしてパスをコピー"
          onClick={async (e) => {
            e.stopPropagation();
            await copyToClipboard(node.evidence[0] ?? "");
          }}
        >
          📄 {node.evidence[0]}
        </div>
      )}

      {/* Footer */}
      {lod !== "structure" && (
        <div className="portal-footer">
          <span>
            {isPortal
              ? `${preview.childCount} inside · ${preview.descendantCount} deep`
              : "no inner flow"}
          </span>
          <div>
            {onAskAi && (
              <button
                className="ai-action-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onAskAi();
                }}
                title="このノードについてAIに尋ねる"
                type="button"
              >
                ✦ Ask AI
              </button>
            )}
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
