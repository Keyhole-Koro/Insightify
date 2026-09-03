import { createRoot } from "react-dom/client";
import type { GeneratedFlowGraph } from "@insightify/graph-domain";
import type { AgentCapabilities, ProviderInstallation } from "@insightify/agent-runtime";
import type { InsightifyDesktopApi, ProjectSummary } from "@insightify/desktop-bridge";
import { App } from "../src/renderer/App.js";
import { previewGraph } from "./fixture.js";
import "../src/renderer/styles.css";

// A renderer-only harness: the real App against a stubbed preload bridge, so the
// FlowFold canvas can be driven and recorded without an agent CLI or Electron.
const project: ProjectSummary = {
  id: previewGraph.projectId,
  displayName: "Insightify",
  canonicalPath: "/home/user/Workspaces/Insightify",
  sandboxPath: "/home/user/.insightify/sandboxes/0b6f4d3e-3f2a-4b7c-8d1e-9a0c5f2b7d41",
  lastOpenedAt: previewGraph.generatedAt,
};
let stored: GeneratedFlowGraph = previewGraph;

const capabilities: AgentCapabilities = {
  managedSubscriptionLogin: true, accountStatus: true, rateLimits: "structured", persistentThreads: true,
  forkThread: true, resumeThread: true, interactiveApprovals: true, sandboxPolicy: "structured",
  structuredOutput: true, streamedToolEvents: true, cancelTurn: true,
};
const installed = (provider: ProviderInstallation["provider"]): ProviderInstallation => ({ provider, installed: true, version: "preview", error: null, capabilities });

const api: InsightifyDesktopApi = {
  pickProject: async () => project,
  listProjects: async () => [project],
  getProjectGraph: async () => stored,
  saveProjectGraph: async (value) => { stored = value; return value; },
  // The fixture has no project directory to hash, so the honest answer is
  // that freshness cannot be established.
  checkGraphFreshness: async () => ({ state: "unknown" as const, checkedAt: previewGraph.generatedAt }),
  probeProviders: async () => [installed("antigravity-cli"), installed("codex")],
  startAgentRun: async () => ({ threadId: "preview-thread", runId: "preview-run" }),
  generateFlowGraph: async () => ({ threadId: "preview-thread", runId: "preview-run" }),
  regenerateLayout: async () => ({ threadId: "preview-thread", runId: "preview-run" }),
  cancelAgentRun: async () => {},
  respondToAgentApproval: async () => {},
  onAgentEvent: () => () => {},
  onGraphGeneration: () => () => {},
};

(window as unknown as { insightify: InsightifyDesktopApi }).insightify = api;
createRoot(document.getElementById("root")!).render(<App />);
