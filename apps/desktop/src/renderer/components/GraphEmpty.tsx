import React from "react";
import type { ProviderInstallation } from "@insightify/agent-runtime";
import type { StartRunResult } from "@insightify/desktop-bridge";

interface GraphEmptyProps {
  loading: boolean;
  generating: boolean;
  provider: ProviderInstallation | null;
  meta: { label: string };
  run: StartRunResult | null;
  onGenerate: () => void;
  onCancel: () => void;
}

export function GraphEmpty({
  loading,
  generating,
  provider,
  meta,
  run,
  onGenerate,
  onCancel,
}: GraphEmptyProps) {
  return (
    <div className="empty-project graph-empty">
      <div className={generating ? "empty-orbit generating" : "empty-orbit"} />
      <h1>
        {loading
          ? "Loading FlowFold Graph…"
          : generating
          ? `${meta.label} is mapping the project…`
          : "Turn this repository into a FlowFold Graph."}
      </h1>
      <p>
        {generating
          ? "A safe project snapshot is being analyzed. Layout is computed locally after validation."
          : "The selected AI identifies semantic rooms and flows. Generation only starts when you ask."}
      </p>
      {!loading && !generating && (
        <button
          className="primary-button"
          disabled={!provider?.installed}
          onClick={onGenerate}
          type="button"
        >
          Generate with {meta.label}
        </button>
      )}
      {generating && run && (
        <button className="stop-button" onClick={onCancel} type="button">
          Stop generation
        </button>
      )}
    </div>
  );
}
