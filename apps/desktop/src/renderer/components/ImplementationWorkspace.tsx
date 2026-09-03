import React, { useEffect } from "react";
import { Maximize2, MessageSquareText, PanelRightOpen, X } from "lucide-react";
import type { FlowNode } from "@insightify/graph-domain";
import { ImplementationTree } from "./ImplementationTree.js";

interface ImplementationWorkspaceProps {
  node: FlowNode;
  placement: {
    anchorX: number;
    anchorY: number;
    height: number;
    left: number;
    side: "bottom" | "left" | "right" | "top";
    top: number;
    width: number;
  };
  onClose: () => void;
  onPeek: () => void;
  onAskAi: () => void;
}

export function ImplementationWorkspace({
  node,
  placement,
  onClose,
  onPeek,
  onAskAi,
}: ImplementationWorkspaceProps) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  if (!node.implementation) return null;

  const vertical = placement.side === "top" || placement.side === "bottom";
  const edgeX = vertical
    ? Math.max(placement.left + 28, Math.min(placement.anchorX, placement.left + placement.width - 28))
    : placement.side === "left" ? placement.left + placement.width : placement.left;
  const edgeY = placement.side === "top"
    ? placement.top + placement.height
    : placement.side === "bottom"
      ? placement.top
      : Math.max(placement.top + 42, Math.min(placement.anchorY, placement.top + placement.height - 28));
  const bendX = (placement.anchorX + edgeX) / 2;
  const bendY = (placement.anchorY + edgeY) / 2;
  const connector = vertical
    ? `M ${placement.anchorX} ${placement.anchorY} C ${placement.anchorX} ${bendY}, ${edgeX} ${bendY}, ${edgeX} ${edgeY}`
    : `M ${placement.anchorX} ${placement.anchorY} C ${bendX} ${placement.anchorY}, ${bendX} ${edgeY}, ${edgeX} ${edgeY}`;

  return (
    <div
      className="implementation-inline-layer"
      data-vqa="implementation-inline-layer"
      data-vqa-node-id={node.id}
    >
      <svg aria-hidden="true" className="implementation-inline-connector">
        <path
          d={connector}
        />
        <circle cx={placement.anchorX} cy={placement.anchorY} r="3.5" />
      </svg>
      <aside
        aria-label={`${node.title} implementation outline`}
        className={`implementation-workspace inline-${placement.side}`}
        data-vqa="implementation-workspace"
        role="region"
        style={{
          height: placement.height,
          left: placement.left,
          top: placement.top,
          width: placement.width,
        }}
      >
        <header className="implementation-workspace-header">
          <div className="implementation-workspace-title">
            <span><Maximize2 aria-hidden="true" size={11} /> Implementation in flow</span>
            <h2>{node.title}</h2>
            <p>{node.summary}</p>
          </div>
          <div className="implementation-workspace-actions">
            <button onClick={onPeek} title="ノードの全情報をサイドパネルで見る" type="button">
              <PanelRightOpen aria-hidden="true" size={14} /> Peek
            </button>
            <button onClick={onAskAi} title="この実装についてAIに尋ねる" type="button">
              <MessageSquareText aria-hidden="true" size={14} /> Ask AI
            </button>
            <button aria-label="実装ワークスペースを閉じる" onClick={onClose} type="button">
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        </header>

        <div className="implementation-workspace-context">
          <span>{node.kind}</span>
          {node.technology && <span>{node.technology}</span>}
          {node.tags?.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}
          <em>attached to node</em>
        </div>

        <ImplementationTree outline={node.implementation} workspace />
      </aside>
    </div>
  );
}
