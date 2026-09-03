import React, { type PointerEvent as ReactPointerEvent } from "react";
import { isRoom, nodeExtent, type FlowNode, type PortalPreview } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";
import { NodeIcon } from "./NodeIcon.js";

interface PortalCardProps {
  node: FlowNode & { x: number; y: number };
  preview: PortalPreview;
  /* Which entry point into the implementation outline this card offers: the
     chevron at the implementation level, the plate's button below it. Only how
     the card is drawn — how large it is must not depend on the level, because
     the level follows from the stage the sizes produced. */
  lod: SemanticLevel;
  selected: boolean;
  isExpanded?: boolean;
  isScopeExpanded?: boolean;
  implementationOpen?: boolean;
  isNestedChild?: boolean;
  isLeavingScope?: boolean;
  showAvatar?: boolean;
  connections: { input: boolean; output: boolean };
  onSelect: () => void;
  onPeek: () => void;
  onEnter: () => void;
  onEdit: () => void;
  onAskAi?: () => void;
  onOpenImplementation?: () => void;
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
  isScopeExpanded = false,
  implementationOpen = false,
  isNestedChild = false,
  isLeavingScope = false,
  showAvatar = true,
  connections,
  onSelect,
  onPeek,
  onEnter,
  onEdit,
  onAskAi,
  onOpenImplementation,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: PortalCardProps) {
  const isPortal = preview.childCount > 0 || isRoom(node);
  const hasImplementationWorkspace = lod === "implementation" && Boolean(node.implementation);

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
  const extent = nodeExtent({
    nested: isNestedChild,
    expanded: isExpanded,
    hasImplementation: Boolean(node.implementation),
  });

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
      }${implementationOpen ? " implementation-open" : ""}${httpMethod ? ` method-${httpMethod.toLowerCase()}` : ""}${tech ? ` tech-${tech.toLowerCase()}` : ""}`}
      role="button"
      data-vqa="flow-node"
      data-vqa-node-id={node.id}
      data-vqa-parent-id={node.parentId ?? "root"}
      data-vqa-nested={isNestedChild || undefined}
      data-vqa-expanded={isExpanded || undefined}
      data-vqa-extent={`${extent.width}x${extent.height}`}
      data-vqa-stage-x={node.x}
      data-vqa-stage-y={node.y}
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
        <div className="node-avatar-container">
          <div className={`node-avatar shape-${avatarShape}`}>
            <NodeIcon kind={node.kind} technology={tech} size={22} />
            <span className={`node-status-orb status-${status}`} title={`Status: ${status}`} />
          </div>
        </div>
      )}

      {/* THE CARD ITSELF. Drawn whether or not the plate below it is open: it is
          what the node's coordinate points at, so a node that swapped it for the
          plate moved under the cursor of the user who had just clicked it. */}
      <div className="node-compact-pill" data-vqa-node-id={node.id}>
          {isNestedChild ? (
            <span className="compact-icon" aria-hidden="true">
              <NodeIcon kind={node.kind} technology={tech} size={14} />
            </span>
          ) : (
            !showAvatar && (
              <span className={`node-status-dot status-${status}`} title={`Status: ${status}`} />
            )
          )}
          {/* The icon already says what kind of node this is, so the text tag
              stays only where it carries something the icon cannot: a method,
              or a node drawn without an avatar. This rule was written for
              nested children, where space is obviously short. It applies just
              as well to a root card carrying an avatar — the tag was taking
              more room than the title there, and "POSTGRESQL" was pushing
              "PostgreSQL Database" into an ellipsis while the Postgres icon sat
              directly above it. A nested child never shows it: its frame
              already says which Room it belongs to. */}
          {((!isNestedChild && !showAvatar) || httpMethod) && (
            <span className={`compact-kind-tag${httpMethod ? ` tag-method-${httpMethod.toLowerCase()}` : ""}`}>
              {tagLabel}
            </span>
          )}
          <span className="compact-title" title={node.title}>
            {displayTitle}
          </span>
        {/* What this card will show if it is clicked. A Room shows the flow
            inside it; anything else shows its own detail. The glyph is the only
            trace of that difference the card can afford — the button it
            replaces was taking 69 of the card's 190px, and taking them from
            the title. */}
        <span
          className="compact-toggle-icon"
          data-vqa-action={
            isPortal
              ? "toggle-room-inline"
              : hasImplementationWorkspace
                ? "toggle-implementation-workspace"
                : "toggle-detail"
          }
          data-vqa-node-id={node.id}
          title={
            isPortal
              ? isScopeExpanded ? "内部ノードを折りたたむ" : "内部ノードを展開"
              : hasImplementationWorkspace
                ? implementationOpen ? "実装ワークスペースを閉じる" : "実装ワークスペースを開く"
                : isExpanded ? "詳細を閉じる" : "詳細を開く"
          }
        >
          {isPortal
            ? (isScopeExpanded ? "⊟" : "⊞")
            : hasImplementationWorkspace
              ? (implementationOpen ? "×" : "↗")
              : isExpanded ? "▴" : "▾"}
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
          {/* The code snippet, the child miniature and the evidence used to be
              here at the implementation zoom level, and they were most of the
              plate: 206px of it, next to a card 34px tall. A detail view six
              cards high cannot be opened without covering something, and all
              three are in the Peek panel this plate's own footer opens.

              The way into the implementation outline stays, because nothing
              else on the card leads there. It is not tied to a zoom level: a
              plate whose height depends on the level makes how large a node is
              depend on how large the stage turned out, which is a circle. */}
          {node.implementation && (
            <button
              className="plate-implementation-launch"
              data-vqa-action="open-implementation-workspace"
              onClick={(event) => {
                event.stopPropagation();
                onOpenImplementation?.();
              }}
              type="button"
            >
              <span>Implementation lens</span>
              Open on canvas <b>↗</b>
            </button>
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
