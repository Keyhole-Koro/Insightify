import React, { useEffect } from "react";
import { Maximize2, MessageSquareText, PanelRightOpen, X } from "lucide-react";
import type { FlowNode } from "@insightify/graph-domain";
import { ImplementationTree } from "./ImplementationTree.js";

interface ImplementationWorkspaceProps {
  node: FlowNode;
  onClose: () => void;
  onPeek: () => void;
  onAskAi: () => void;
}

export function ImplementationWorkspace({
  node,
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

  return (
    <div
      className="implementation-workspace-layer"
      data-vqa="implementation-workspace"
      data-vqa-node-id={node.id}
    >
      <button
        aria-label="実装ワークスペースを閉じる"
        className="implementation-workspace-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={`${node.title} implementation workspace`}
        className="implementation-workspace"
        role="dialog"
      >
        <header className="implementation-workspace-header">
          <div className="implementation-workspace-title">
            <span><Maximize2 aria-hidden="true" size={12} /> Implementation lens</span>
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
          <em>anchored to canvas node</em>
        </div>

        <ImplementationTree outline={node.implementation} workspace />
      </section>
    </div>
  );
}
