import React, { useMemo, useState } from "react";
import {
  Braces,
  ChevronRight,
  CornerDownLeft,
  GitBranch,
  PhoneCall,
  Zap,
} from "lucide-react";
import type {
  ImplementationLeaf,
  ImplementationOutline,
  ImplementationStep,
  ImplementationStepKind,
  SourceReference,
} from "@insightify/graph-domain";
import { copyToClipboard } from "../lib/clipboard.js";

interface ImplementationTreeProps {
  outline: ImplementationOutline;
  compact?: boolean;
  workspace?: boolean;
}

type TreeItem = ImplementationStep | ImplementationLeaf;

function KindIcon({ kind }: { kind: ImplementationStepKind }) {
  const props = { size: 12, strokeWidth: 1.8, "aria-hidden": true } as const;
  if (kind === "condition") return <GitBranch {...props} />;
  if (kind === "call") return <PhoneCall {...props} />;
  if (kind === "side-effect") return <Zap {...props} />;
  if (kind === "return") return <CornerDownLeft {...props} />;
  return <Braces {...props} />;
}

function sourceLabel(source: SourceReference): string {
  const lines = source.startLine
    ? `:${source.startLine}${source.endLine && source.endLine !== source.startLine ? `-${source.endLine}` : ""}`
    : "";
  return `${source.path}${lines}${source.symbol ? ` · ${source.symbol}` : ""}`;
}

function childrenOf(item: TreeItem): ImplementationLeaf[] {
  return "children" in item ? item.children ?? [] : [];
}

export function ImplementationTree({
  outline,
  compact = false,
  workspace = false,
}: ImplementationTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string>(() => outline.steps[0]?.id ?? "");
  const [copiedSource, setCopiedSource] = useState<string | null>(null);
  const items = useMemo(
    () => outline.steps.flatMap((step) => [step, ...(step.children ?? [])]),
    [outline]
  );
  const selected = items.find((item) => item.id === selectedId) ?? outline.steps[0];

  function select(item: TreeItem) {
    setSelectedId(item.id);
    if (childrenOf(item).length > 0) {
      setExpandedIds((current) => {
        const next = new Set(current);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
  }

  async function copySource(source: SourceReference) {
    const label = sourceLabel(source);
    if (await copyToClipboard(label)) {
      setCopiedSource(label);
      window.setTimeout(() => setCopiedSource(null), 1400);
    }
  }

  function renderRow(item: TreeItem, depth: number) {
    const children = childrenOf(item);
    const expanded = expandedIds.has(item.id);
    const selectedRow = selected?.id === item.id;
    return (
      <li className="implementation-step-item" key={item.id}>
        <button
          aria-expanded={children.length > 0 ? expanded : undefined}
          className={`implementation-step${selectedRow ? " selected" : ""}`}
          data-vqa="implementation-step"
          data-vqa-depth={depth}
          data-vqa-has-children={children.length > 0 || undefined}
          data-vqa-kind={item.kind}
          data-vqa-step-id={item.id}
          onClick={(event) => {
            event.stopPropagation();
            select(item);
          }}
          onMouseEnter={() => setSelectedId(item.id)}
          type="button"
        >
          <span className={`implementation-disclosure${children.length === 0 ? " leaf" : ""}`}>
            <ChevronRight aria-hidden="true" size={11} strokeWidth={2} />
          </span>
          <span className={`implementation-kind kind-${item.kind}`}>
            <KindIcon kind={item.kind} />
          </span>
          <span className="implementation-step-title">{item.title}</span>
          <span className="implementation-step-kind">{item.kind}</span>
        </button>
        {expanded && children.length > 0 && (
          <ul className="implementation-step-children">
            {children.map((child) => renderRow(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div
      className={`implementation-tree${compact ? " compact" : ""}${workspace ? " workspace" : ""}`}
      data-vqa="implementation-tree"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="implementation-tree-header">
        <span>Implementation</span>
        <strong title={outline.entrypoint}>{outline.entrypoint}</strong>
        <button
          className={copiedSource === sourceLabel(outline.source) ? "copied" : ""}
          data-vqa-action="copy-source-ref"
          onClick={() => void copySource(outline.source)}
          title="Copy source reference"
          type="button"
        >
          {copiedSource === sourceLabel(outline.source) ? "Copied" : sourceLabel(outline.source)}
        </button>
      </header>

      <div className="implementation-tree-body">
        <div className="implementation-step-scroll">
          <ul className="implementation-step-list">{outline.steps.map((step) => renderRow(step, 0))}</ul>
        </div>
        {selected && (
          <div className="implementation-step-detail" data-vqa="implementation-step-detail">
            <div className="implementation-detail-heading">
              <span>{selected.kind}</span>
              <strong>{selected.title}</strong>
            </div>
            <p>{selected.summary}</p>
            {(selected.inputs?.length || selected.outputs?.length) && (
              <div className="implementation-io">
                {selected.inputs?.map((input) => <span className="input" key={`in-${input}`}>in · {input}</span>)}
                {selected.outputs?.map((output) => <span className="output" key={`out-${output}`}>out · {output}</span>)}
              </div>
            )}
            {selected.source && (
              <button
                className={copiedSource === sourceLabel(selected.source) ? "copied" : ""}
                data-vqa-action="copy-source-ref"
                onClick={() => void copySource(selected.source!)}
                type="button"
              >
                {copiedSource === sourceLabel(selected.source) ? "Copied" : sourceLabel(selected.source)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
