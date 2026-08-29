import React from "react";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import { kindIcon } from "../lib/flowfold-helpers.js";

interface PeekPanelProps {
  node: FlowNode;
  graph: GeneratedFlowGraph;
  onClose: () => void;
  onEnter: () => void;
  onEdit: () => void;
}

export function PeekPanel({ node, graph, onClose, onEnter, onEdit }: PeekPanelProps) {
  const children = graph.graph.nodes.filter((item) => item.parentId === node.id);
  const connected = graph.graph.edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id
  );

  return (
    <aside className="peek-panel" aria-label="Node preview details">
      <header>
        <span>
          PEEK · {node.kind}
        </span>
        <button onClick={onClose} type="button" aria-label="Close peek">
          ×
        </button>
      </header>
      <h2>{node.title}</h2>
      <p>{node.summary}</p>
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
        <b>Evidence</b>
        {node.evidence.length ? (
          node.evidence.map((item) => <code key={item}>{item}</code>)
        ) : (
          <em>No artifact links</em>
        )}
      </section>
      <section>
        <b>Connections</b>
        <em>{connected.length} edges</em>
      </section>
      <footer>
        <button onClick={onEdit} type="button">
          Edit node
        </button>
        <button className="primary-button" onClick={onEnter} type="button">
          Enter Room
        </button>
      </footer>
    </aside>
  );
}
