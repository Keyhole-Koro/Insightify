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
  const tech =
    node.technology ||
    node.tags?.find((t) =>
      /aws|gcp|azure|docker|k8s|kubernetes|postgres|redis|openai|stripe|github|react|graphql|rest/i.test(t)
    );

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

  // Determine geometric avatar shape based on kind & tech
  const avatarShape = (() => {
    if (node.kind === "database" || node.kind === "data") return "cylinder";
    if (node.kind === "decision") return "diamond";
    if (node.kind === "auth") return "shield";
    if (node.kind === "queue") return "pipe";
    if (node.kind === "api") return "capsule";
    if (node.kind === "external") return "cloud";
    if (node.kind === "ui") return "window";
    return "rounded";
  })();

  return (
    <article
      aria-label={`${node.title}. ${node.kind}. ${
        isPortal ? `Portal containing ${preview.descendantCount} nodes` : "No inner flow yet"
      }`}
      className={`flow-node shape-${avatarShape} kind-${node.kind} status-${status}${
        selected ? " selected" : ""
      }${isPortal ? " is-portal" : ""}${tech ? ` tech-${tech.toLowerCase()}` : ""}`}
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
      {/* Wiring Ports on outer container */}
      <span
        className={connections.input ? "card-port in connected" : "card-port in"}
        aria-hidden="true"
      />
      <span
        className={connections.output ? "card-port out connected" : "card-port out"}
        aria-hidden="true"
      />

      {/* TOP AVATAR / ICONIC SHAPE */}
      <div className="node-avatar-container">
        <div className={`node-avatar shape-${avatarShape}`}>
          <NodeIcon kind={node.kind} technology={tech} size={24} />
          <span className={`node-status-orb status-${status}`} title={`Status: ${status}`} />
        </div>
      </div>

      {/* BOTTOM DETAIL RECTANGLE PLATE */}
      <div className="node-detail-plate">
        {/* Plate Header */}
        <div className="plate-header">
          <span className="plate-kind-badge">{tech || node.kind}</span>
          <div className="plate-header-actions">
            <button
              className={`plate-copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopy}
              title="ノード情報をコピー"
              type="button"
            >
              {copied ? "✓" : "📋"}
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="plate-title">{node.title}</h3>

        {/* Tags (visible in flow and implementation LOD) */}
        {node.tags && node.tags.length > 0 && lod !== "structure" && (
          <div className="plate-tags">
            {node.tags.map((tag) => (
              <span key={tag} className="portal-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Summary */}
        {lod !== "structure" && <p className="plate-summary">{node.summary}</p>}

        {/* Code Snippet in Implementation LOD */}
        {lod === "implementation" && node.codeSnippet && (
          <div className="plate-code-block">
            <code>{node.codeSnippet}</code>
          </div>
        )}

        {/* Nested Portal Fold */}
        {isPortal && <PortalFold preview={preview} lod={lod} />}

        {/* Evidence file path in Implementation LOD */}
        {lod === "implementation" && node.evidence.length > 0 && (
          <div
            className="plate-evidence"
            title="クリックしてパスをコピー"
            onClick={async (e) => {
              e.stopPropagation();
              await copyToClipboard(node.evidence[0] ?? "");
            }}
          >
            📄 {node.evidence[0]}
          </div>
        )}

        {/* Plate Footer */}
        {lod !== "structure" && (
          <div className="plate-footer">
            <span className="plate-inner-count">
              {isPortal
                ? `${preview.childCount} inside · ${preview.descendantCount} deep`
                : "no inner flow"}
            </span>
            <div className="plate-actions">
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
                  ✦ AI
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
      </div>
    </article>
  );
}
