import React from "react";
import type { AgentEvent, ProviderInstallation } from "@insightify/agent-runtime";
import type {
  ExecutableAgentProvider,
  ProjectSummary,
  StartRunResult,
} from "@insightify/desktop-bridge";
import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import type { AppError } from "../lib/errors.js";
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
        <div className="context-card">
          <span>{anchor ? `Node · ${anchor.kind}` : "Root context"}</span>
          <strong>{anchor?.title ?? project?.displayName ?? "Select a project"}</strong>
          <p>
            {anchor?.summary ??
              graph?.graph.summary ??
              "Generate a semantic graph to establish the root scope."}
          </p>
          {anchor?.evidence.map((item) => (
            <code key={item}>{item}</code>
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
            <GraphGenerationStream transcript={transcript} expansion={anchor !== null} />
          </>
        )}

        {!generating && transcript && (
          <div className="assistant-message">
            <span>{meta.label}</span>
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
