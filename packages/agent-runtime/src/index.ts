// Every provider the runtime knows about. The type is derived from the list so
// that adding a provider is a single edit, and every place that enumerates
// providers is forced by the compiler to say what it does with the new one.
export const AGENT_PROVIDER_KINDS = ["codex", "antigravity-cli", "antigravity-sdk"] as const;

export type AgentProviderKind = (typeof AGENT_PROVIDER_KINDS)[number];

export type AgentCapabilities = {
  managedSubscriptionLogin: boolean;
  accountStatus: boolean;
  rateLimits: "structured" | "text" | "none";
  persistentThreads: boolean;
  forkThread: boolean;
  resumeThread: boolean;
  interactiveApprovals: boolean;
  sandboxPolicy: "structured" | "provider-config" | "none";
  structuredOutput: boolean;
  streamedToolEvents: boolean;
  cancelTurn: boolean;
};

export type ProviderInstallation = {
  provider: AgentProviderKind;
  installed: boolean;
  version: string | null;
  error: string | null;
  capabilities: AgentCapabilities;
};

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

type AgentEventBase = {
  provider: AgentProviderKind;
  projectId: string;
  sequence: number;
  timestamp: string;
  threadId: string | null;
  runId: string | null;
};

export type AgentEvent =
  | (AgentEventBase & { type: "provider.connected"; version: string | null })
  | (AgentEventBase & { type: "provider.disconnected"; reason: string })
  | (AgentEventBase & { type: "run.started" })
  | (AgentEventBase & { type: "assistant.delta"; text: string })
  | (AgentEventBase & { type: "reasoning.delta"; text: string })
  | (AgentEventBase & { type: "tool.started"; itemId: string; tool: string; summary: string })
  | (AgentEventBase & { type: "tool.completed"; itemId: string; tool: string; success: boolean })
  | (AgentEventBase & {
      type: "approval.requested";
      requestId: string;
      itemId: string;
      approvalKind: "command" | "file-change";
      reason: string | null;
      command: string | null;
      cwd: string | null;
    })
  | (AgentEventBase & { type: "approval.resolved"; requestId: string })
  | (AgentEventBase & { type: "diff.updated"; diff: string })
  | (AgentEventBase & { type: "file.reading"; path: string; totalFiles?: number; currentFileIndex?: number })
  | (AgentEventBase & { type: "usage.updated"; usage: unknown })
  | (AgentEventBase & { type: "warning"; message: string })
  | (AgentEventBase & { type: "run.completed"; status: "completed" | "interrupted" })
  | (AgentEventBase & { type: "run.failed"; message: string; code: string | null })
  | (AgentEventBase & { type: "provider.event"; method: string; payload: unknown });

export function codexCapabilities(): AgentCapabilities {
  return {
    managedSubscriptionLogin: true,
    accountStatus: true,
    rateLimits: "structured",
    persistentThreads: true,
    forkThread: true,
    resumeThread: true,
    interactiveApprovals: true,
    sandboxPolicy: "structured",
    structuredOutput: true,
    streamedToolEvents: true,
    cancelTurn: true,
  };
}

export function antigravityCliCapabilities(): AgentCapabilities {
  return {
    managedSubscriptionLogin: true,
    accountStatus: false,
    rateLimits: "text",
    persistentThreads: false,
    forkThread: false,
    resumeThread: true,
    interactiveApprovals: false,
    sandboxPolicy: "provider-config",
    structuredOutput: true,
    streamedToolEvents: true,
    cancelTurn: true,
  };
}
