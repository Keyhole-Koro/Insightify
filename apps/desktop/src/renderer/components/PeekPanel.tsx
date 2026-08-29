import React, { useState } from "react";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import { kindIcon } from "../lib/flowfold-helpers.js";
import { copyToClipboard } from "../lib/clipboard.js";

interface PeekPanelProps {
  node: FlowNode;
  graph: GeneratedFlowGraph;
  onClose: () => void;
  onEnter: () => void;
  onEdit: () => void;
  onAskAi?: () => void;
}

export function PeekPanel({ node, graph, onClose, onEnter, onEdit, onAskAi }: PeekPanelProps) {
  const [copied, setCopied] = useState(false);
  const children = graph.graph.nodes.filter((item) => item.parentId === node.id);
  const connected = graph.graph.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );

  async function handleCopyAll() {
    const text = [
      `Node: ${node.title}`,
      `Kind: ${node.kind}`,
      `Status: ${node.status ?? "idle"}`,
      `Summary: ${node.summary}`,
      node.tags?.length ? `Tags: ${node.tags.map((t) => `#${t}`).join(", ")}` : "",
      node.evidence.length ? `Evidence:\n${node.evidence.map((e) => `- ${e}`).join("\n")}` : "",
      node.codeSnippet ? `\nCode Snippet:\n\`\`\`\n${node.codeSnippet}\n\`\`\`` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <aside className="peek-panel" aria-label="Node preview details">
      <header>
        <div>
          <span>
            PEEK · {node.kind} {node.status ? `· ${node.status}` : ""}
          </span>
          <h2>{node.title}</h2>
        </div>
        <button onClick={onClose} type="button" aria-label="Close peek">
          ×
        </button>
      </header>

      {node.tags && node.tags.length > 0 && (
        <div className="peek-tags">
          {node.tags.map((tag) => (
            <span key={tag} className="portal-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <p>{node.summary}</p>

      {node.codeSnippet && (
        <section className="peek-code-section">
          <b>Code / Interface</b>
          <pre className="peek-code-block">
            <code>{node.codeSnippet}</code>
          </pre>
        </section>
      )}

      <section>
        <b>Nested nodes</b>
        {children.length ? (
          children.map((child) => (
            <span key={child.id}>
              {kindIcon(child.kind)} {child.title}
            </span>
          ))
        ) : (
          <em>None yet</em>
        )}
      </section>

      <section>
        <b>Evidence paths</b>
        {node.evidence.length ? (
          node.evidence.map((item) => (
            <code
              key={item}
              className="clickable-code"
              title="クリックしてパスをコピー"
              onClick={() => copyToClipboard(item)}
            >
              📋 {item}
            </code>
          ))
        ) : (
          <em>No artifact links</em>
        )}
      </section>

      <section>
        <b>Connections</b>
        <em>{connected.length} edges</em>
      </section>

      <footer>
        <button
          className={`copy-button ${copied ? "copied" : ""}`}
          onClick={handleCopyAll}
          type="button"
        >
          {copied ? "Copied! ✓" : "📋 Copy details"}
        </button>
        {onAskAi && (
          <button className="ai-action-btn" onClick={onAskAi} type="button">
            ✦ Ask AI
          </button>
        )}
        <button onClick={onEdit} type="button">
          Edit
        </button>
        <button className="primary-button" onClick={onEnter} type="button">
          Enter Room
        </button>
      </footer>
    </aside>
  );
}
