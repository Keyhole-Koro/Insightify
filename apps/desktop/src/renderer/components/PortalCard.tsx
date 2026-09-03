import React, { type PointerEvent as ReactPointerEvent } from "react";
import { isRoom, nodeExtent, type FlowNode, type PortalPreview } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";
import { copyToClipboard } from "../lib/clipboard.js";
import { NodeIcon } from "./NodeIcon.js";
import { PortalFold } from "./PortalFold.js";

interface PortalCardProps {
  node: FlowNode & { x: number; y: number };
  preview: PortalPreview;
  lod: SemanticLevel;
  selected: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isScopeExpanded?: boolean;
  onToggleScopeExpand?: () => void;
  isNestedChild?: boolean;
  isLeavingScope?: boolean;
  showAvatar?: boolean;
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
  isExpanded = false,
  onToggleExpand,
  isScopeExpanded = false,
  onToggleScopeExpand,
  isNestedChild = false,
  isLeavingScope = false,
  showAvatar = true,
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
  const isPortal = preview.childCount > 0 || isRoom(node);

  const status = node.status ?? (preview.childCount > 0 ? "ready" : "idle");
  const tech =
    node.technology ||
    node.tags?.find((t) =>
      /aws|gcp|azure|docker|k8s|kubernetes|postgres|redis|openai|stripe|github|react|graphql|rest/i.test(t)
    );

  // Extract HTTP method or protocol if node title has "GET /...", "POST /...", etc.
  const httpMethodMatch = node.title.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|GRAPHQL|GQL)\b/i);
  const httpMethod = httpMethodMatch?.[1]?.toUpperCase();
  const displayTitle = httpMethod ? node.title.replace(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|GRAPHQL|GQL)\s+/i, "") : node.title;
  const tagLabel = httpMethod || tech || node.kind;

  function handleToggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    }
  }

  function handleToggleScope(event: React.MouseEvent) {
    event.stopPropagation();
    if (onToggleScopeExpand) {
      onToggleScopeExpand();
    }
  }

  // Geometric avatar shape
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

  // What the layout has been told this card occupies. Declared on the element
  // so `visual:qa` can check it against what is actually painted.
  const extent = nodeExtent({ nested: isNestedChild, expanded: isExpanded, lod });

  return (
    <article
      aria-label={`${node.title}. ${node.kind}. ${
        isPortal ? `Portal containing ${preview.descendantCount} nodes` : "No inner flow yet"
      }`}
      aria-hidden={isScopeExpanded || undefined}
      className={`flow-node shape-${avatarShape} kind-${node.kind} status-${status}${
        selected ? " selected" : ""
      }${isExpanded ? " is-expanded" : " is-compact"}${isPortal ? " is-portal" : ""}${
        isScopeExpanded ? " is-scope-expanded" : ""
      }${isNestedChild ? " is-nested-child" : ""}${!showAvatar ? " no-avatar" : ""}${
        isLeavingScope ? " is-leaving-scope" : ""
      }${httpMethod ? ` method-${httpMethod.toLowerCase()}` : ""}${tech ? ` tech-${tech.toLowerCase()}` : ""}`}
      role="button"
      data-vqa="flow-node"
      data-vqa-node-id={node.id}
      data-vqa-parent-id={node.parentId ?? "root"}
      data-vqa-nested={isNestedChild || undefined}
      data-vqa-expanded={isExpanded || undefined}
      data-vqa-extent={`${extent.width}x${extent.height}`}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      tabIndex={isScopeExpanded ? -1 : 0}
      onClick={() => {
        onSelect();
      }}
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
      {/* Wiring Ports */}
      <span
        className={connections.input ? "card-port in connected" : "card-port in"}
        aria-hidden="true"
      />
      <span
        className={connections.output ? "card-port out connected" : "card-port out"}
        aria-hidden="true"
      />

      {/* TOP AVATAR / ICONIC SHAPE. A collapsed nested child carries its icon
          inside the pill instead of above it: stacking the two costs roughly
          twice the height, and height is what an unfolded Room is short of. */}
      {showAvatar && !(isNestedChild && !isExpanded) && (
        <div className="node-avatar-container" onClick={handleToggle} title="クリックで詳細を開閉">
          <div className={`node-avatar shape-${avatarShape}`}>
            <NodeIcon kind={node.kind} technology={tech} size={22} />
            <span className={`node-status-orb status-${status}`} title={`Status: ${status}`} />
          </div>
        </div>
      )}

      {/* THE CARD ITSELF. Drawn whether or not the plate below it is open: it is
          what the node's coordinate points at, so a node that swapped it for the
          plate moved under the cursor of the user who had just clicked it. */}
      <div
        className="node-compact-pill"
        onClick={handleToggle}
        title={isExpanded ? "クリックで詳細を閉じる" : "クリックで詳細を展開"}
      >
          {isNestedChild ? (
            <span className="compact-icon" aria-hidden="true">
              <NodeIcon kind={node.kind} technology={tech} size={14} />
            </span>
          ) : (
            !showAvatar && (
              <span className={`node-status-dot status-${status}`} title={`Status: ${status}`} />
            )
          )}
          {/* The icon already says what kind of node this is. The text tag
              stays only where it carries something the icon cannot: a method. */}
          {(!isNestedChild || httpMethod) && (
            <span className={`compact-kind-tag${httpMethod ? ` tag-method-${httpMethod.toLowerCase()}` : ""}`}>
              {tagLabel}
            </span>
          )}
          <span className="compact-title" title={node.title}>
            {displayTitle}
          </span>
          {isPortal && onToggleScopeExpand && (
            <button
              className={`pill-scope-expand-btn ${isScopeExpanded ? "active" : ""}`}
              data-vqa-action="toggle-room-inline"
              data-vqa-node-id={node.id}
              onClick={handleToggleScope}
              title={isScopeExpanded ? "内部ノードを折りたたむ" : "今いる画面で内部ノードを展開"}
              type="button"
            >
              {isScopeExpanded ? "⊟ Fold" : "⊞ Inside"}
            </button>
          )}
        <span className="compact-toggle-icon" title={isExpanded ? "詳細を閉じる" : "詳細を開く"}>
          {isExpanded ? "▴" : "▾"}
        </span>
      </div>

      {/* EXPANDED DETAIL RECTANGLE PLATE (Visible when expanded) */}
      {isExpanded && (
        <div className="node-detail-plate" data-vqa="detail-plate" data-vqa-node-id={node.id}>
          {/* No header: the card above the plate already carries the kind badge
              and the title, and repeating them was most of the plate's height. */}

          {/* Tags */}
          {node.tags && node.tags.length > 0 && (
            <div className="plate-tags">
              {node.tags.map((tag) => (
                <span key={tag} className="portal-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          <p className="plate-summary">{node.summary}</p>

          {/* Code, evidence and the miniature are what the implementation level
              exists for. Below it they are unreadable at this width anyway, and
              they cost the height that hides the cards above and below. The Peek
              panel carries them at any zoom. */}
          {lod === "implementation" && (
            <>
              {node.codeSnippet && (
                <div className="plate-code-block">
                  <code>{node.codeSnippet}</code>
                </div>
              )}

              {isPortal && <PortalFold preview={preview} lod={lod} />}

              {node.evidence.length > 0 && (
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
            </>
          )}

          {/* Plate Footer */}
          <div className="plate-footer">
            <span className="plate-inner-count">
              {isPortal
                ? `${preview.childCount} inside · ${preview.descendantCount} deep`
                : "no inner flow"}
            </span>
            {/* Four actions that do four different things. The buttons this
                plate lost were the ones that repeated something already within
                reach: collapsing, which is the card's own click; unfolding the
                Room, which is on the pill and on the Room's frame; and copying,
                which the Peek panel does. */}
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
                title="コード・evidence・子ノードを含む詳細を開く"
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
        </div>
      )}
    </article>
  );
}
