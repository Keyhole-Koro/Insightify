import React, { useState } from "react";
import type { AgentEvent, ProviderInstallation } from "@insightify/agent-runtime";
import type {
  ExecutableAgentProvider,
  ProjectSummary,
  StartRunResult,
} from "@insightify/desktop-bridge";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import type { AppError } from "../lib/errors.js";
import { copyToClipboard } from "../lib/clipboard.js";
import {
  generationPhase,
  type ApprovalRequestedEvent,
} from "../lib/flowfold-helpers.js";
import { GraphGenerationStream } from "./GraphGenerationStream.js";
import { PanelError } from "./error/PanelError.js";

interface ThreadPanelProps {
  project: ProjectSummary | null;
  graph: GeneratedFlowGraph | null;
  anchor: FlowNode | null;
  events: AgentEvent[];
  approvals: ApprovalRequestedEvent[];
  transcript: string;
  readingFiles?: string[];
  generating: boolean;
  provider: ProviderInstallation | null;
  providerKind: ExecutableAgentProvider;
  meta: { label: string; policy: string };
  prompt: string;
  busy: boolean;
  run: StartRunResult | null;
  error: AppError | null;
  onPrompt: (value: string) => void;
  onRun: () => void;
  onCancel: () => void;
  onErrorDismiss: () => void;
  onRespondApproval: (requestId: string, decision: "accept" | "decline") => void;
}

export function ThreadPanel({
  project,
  graph,
  anchor,
  events,
  approvals,
  transcript,
  readingFiles = [],
  generating,
  provider,
  providerKind,
  meta,
  prompt,
  busy,
  run,
  error,
  onPrompt,
  onRun,
  onCancel,
  onErrorDismiss,
  onRespondApproval,
}: ThreadPanelProps) {
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  async function handleCopyTranscript() {
    if (!transcript) return;
    const ok = await copyToClipboard(transcript);
    if (ok) {
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 1600);
    }
  }

  return (
    <aside className="thread-panel" aria-label="Agent execution thread">
      <header className="thread-header">
        <div>
          <span className="eyebrow">ANCHORED THREAD</span>
          <h2>{anchor?.title ?? graph?.graph.title ?? "System Room"}</h2>
        </div>
        <span className="thread-count">{events.length}</span>
      </header>

      <div className="thread-body">
        {/* Experimental Safe Workspace Copy Banner */}
        <div className="thread-experimental-banner">
          <span className="banner-icon">🛡️</span>
          <div>
            <strong>試験運用モード (Directory Sandbox Copy)</strong>
            <p>
              元のソースコードは保護され、プロジェクトディレクトリを丸ごと複製した安全な作業環境で実行・検証しています。
            </p>
            {project?.sandboxPath && (
              <code
                className="clickable-code"
                title="クリックして作業コピーのパスをコピー"
                onClick={() => copyToClipboard(project.sandboxPath!)}
              >
                📂 {project.sandboxPath}
              </code>
            )}
          </div>
        </div>

        <div className="context-card">
          <span>{anchor ? `Node · ${anchor.kind}` : "Root context"}</span>
          <strong>{anchor?.title ?? project?.displayName ?? "Select a project"}</strong>
          <p>
            {anchor?.summary ??
              graph?.graph.summary ??
              "Generate a semantic graph to establish the root scope."}
          </p>
          {anchor?.tags && anchor.tags.length > 0 && (
            <div className="portal-tags" style={{ marginTop: "6px" }}>
              {anchor.tags.map((tag) => (
                <span key={tag} className="portal-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {anchor?.evidence.map((item) => (
            <code
              key={item}
              className="clickable-code"
              title="クリックしてパスをコピー"
              onClick={() => copyToClipboard(item)}
            >
              📋 {item}
            </code>
          ))}
        </div>

        {generating && (
          <>
            <div className="generation-card">
              <i />
              <div>
                <strong>Generating FlowFold Graph</strong>
                <p>{generationPhase(events, transcript)} · read-only · validating locally</p>
              </div>
            </div>
            <GraphGenerationStream
              transcript={transcript}
              expansion={anchor !== null}
              readingFiles={readingFiles}
            />
          </>
        )}

        {!generating && transcript && (
          <div className="assistant-message">
            <div className="assistant-message-header">
              <span>{meta.label}</span>
              <button
                className={`copy-chip ${transcriptCopied ? "copied" : ""}`}
                onClick={handleCopyTranscript}
                type="button"
              >
                {transcriptCopied ? "Copied! ✓" : "📋 Copy Output"}
              </button>
            </div>
            <p>{transcript}</p>
          </div>
        )}

        {!generating && !transcript && project && (
          <div className="thread-placeholder">
            Select any Node to anchor this conversation. Its Room path, summary and evidence are
            compiled into the run.
          </div>
        )}

        {approvals.map((approval) => (
          <div className="approval-card" key={approval.requestId}>
            <span>
              {approval.approvalKind === "command"
                ? "Command approval"
                : "File change approval"}
            </span>
            <code>{approval.command ?? approval.reason ?? "Review proposed change"}</code>
            <div>
              <button
                type="button"
                onClick={() => onRespondApproval(approval.requestId, "decline")}
              >
                Decline
              </button>
              <button
                className="approve"
                type="button"
                onClick={() => onRespondApproval(approval.requestId, "accept")}
              >
                Approve once
              </button>
            </div>
          </div>
        ))}

        {error && (
          <PanelError
            error={error}
            onRetry={error.retryable ? onRun : undefined}
            onDismiss={onErrorDismiss}
          />
        )}

        {!provider?.installed && (
          <div className="provider-help">
            <strong>{meta.label} CLI is not available</strong>
            <code>{providerKind === "codex" ? "codex --version" : "agy --version"}</code>
          </div>
        )}
      </div>

      <footer className="composer">
        <textarea
          value={prompt}
          onChange={(event) => onPrompt(event.target.value)}
          placeholder="Ask from this point in the flow…"
          disabled={!project || busy}
        />
        <div className="composer-footer">
          <span>
            {meta.label} · {anchor ? `anchored to ${anchor.title}` : meta.policy}
          </span>
          {busy && run ? (
            <button className="stop-button" onClick={onCancel} type="button">
              Stop
            </button>
          ) : (
            <button
              className="send-button"
              onClick={onRun}
              disabled={!project || busy || !provider?.installed}
              type="button"
            >
              Run with {meta.label} ↗
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
}
