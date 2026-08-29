import React from "react";
import type { ProviderInstallation } from "@insightify/agent-runtime";
import type { ExecutableAgentProvider, ProjectSummary } from "@insightify/desktop-bridge";
import { FLOWFOLD_ROOM_MAX_NODES, type FlowNode, type GeneratedFlowGraph } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";
import { ProviderSwitcher } from "./ProviderSwitcher.js";

const levelLabels: Record<SemanticLevel, string> = {
  structure: "structure",
  flow: "flow",
  implementation: "implementation",
};

interface TopBarProps {
  project: ProjectSummary | null;
  graph: GeneratedFlowGraph | null;
  scopePath: FlowNode[];
  scopeNode: FlowNode | null;
  visibleNodesCount: number;
  boundaryPortsCount: number;
  lod: SemanticLevel;
  busy: boolean;
  provider: ProviderInstallation | null;
  providers: ProviderInstallation[];
  providerKind: ExecutableAgentProvider;
  onNavigateToScope: (scopeId: string | null) => void;
  onRegenerateGraph: () => void;
  onSelectProvider: (kind: ExecutableAgentProvider) => void;
}

export function TopBar({
  project,
  graph,
  scopePath,
  scopeNode,
  visibleNodesCount,
  boundaryPortsCount,
  lod,
  busy,
  provider,
  providers,
  providerKind,
  onNavigateToScope,
  onRegenerateGraph,
  onSelectProvider,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <nav className="breadcrumbs" aria-label="Room breadcrumb">
          <span>Insightify</span>
          <b>/</b>
          <span>{project?.displayName ?? "No project"}</span>
          <b>/</b>
          {graph && (
            <button type="button" onClick={() => onNavigateToScope(null)}>
              {graph.graph.title}
            </button>
          )}
          {scopePath.map((node) => (
            <span className="breadcrumb-segment" key={node.id}>
              <b>/</b>
              <button type="button" onClick={() => onNavigateToScope(node.id)}>
                {node.title}
              </button>
            </span>
          ))}
        </nav>
        <div className="room-meta">
          {scopeNode ? "Nested Room" : "Root scope"} ·{" "}
          <span className={visibleNodesCount > FLOWFOLD_ROOM_MAX_NODES ? "over-dense" : undefined}>
            {visibleNodesCount}/{FLOWFOLD_ROOM_MAX_NODES} portals
          </span>{" "}
          · {boundaryPortsCount} boundary ports · semantic {levelLabels[lod]}
        </div>
      </div>
      <div className="topbar-actions">
        {project && graph && (
          <button
            className="quiet-button"
            disabled={busy || !provider?.installed}
            onClick={onRegenerateGraph}
            type="button"
          >
            Regenerate
          </button>
        )}
        <ProviderSwitcher
          providers={providers}
          selected={providerKind}
          busy={busy}
          onSelect={onSelectProvider}
        />
        <button className="quiet-button" type="button">
          Share
        </button>
      </div>
    </header>
  );
}
