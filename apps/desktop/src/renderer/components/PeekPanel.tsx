import React, { useState } from "react";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import { copyToClipboard } from "../lib/clipboard.js";
import { NodeIcon } from "./NodeIcon.js";

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
  const tech = node.technology || node.tags?.find((t) => /aws|gcp|azure|docker|k8s|postgres|redis|openai|stripe/i.test(t));

  async function handleCopyAll() {
    const text = [
      `Node: ${node.title}`,
      `Kind: ${node.kind}${tech ? ` (${tech})` : ""}`,
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
          <span className="peek-eyebrow">
            <NodeIcon kind={node.kind} technology={tech} size={12} />
            <span>
              {tech || node.kind.toUpperCase()} {node.status ? `· ${node.status}` : ""}
            </span>
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
            <span key={child.id} className="peek-child-node">
              <NodeIcon kind={child.kind} technology={child.technology} size={13} />
              <span>{child.title}</span>
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
