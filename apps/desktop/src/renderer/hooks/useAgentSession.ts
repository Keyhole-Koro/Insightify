import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent, ProviderInstallation } from "@insightify/agent-runtime";
import type {
  ExecutableAgentProvider,
  GraphGenerationEvent,
  StartRunResult,
} from "@insightify/desktop-bridge";
import type { GeneratedFlowGraph } from "@insightify/graph-domain";
import { useBridge } from "../lib/bridge.js";
import { providerMeta, type ProviderMeta } from "../lib/constants.js";
import {
  isApprovalRequested,
  isApprovalResolved,
  type ApprovalRequestedEvent,
} from "../lib/flowfold-helpers.js";

const MAX_RETAINED_EVENTS = 500;

type AgentSessionOptions = {
  projectId: string | null;
  /** Returns true when the graph belonged to the project the user is still looking at. */
  onGraphGenerated: (value: GeneratedFlowGraph, scopeNodeId: string | null) => boolean;
  onError: (reason: unknown) => void;
  clearError: () => void;
};

export type AgentSession = {
  providers: ProviderInstallation[];
  provider: ProviderInstallation | null;
  providerKind: ExecutableAgentProvider;
  meta: ProviderMeta;
  selectProvider: (kind: ExecutableAgentProvider) => void;
  events: AgentEvent[];
  clearEvents: () => void;
  transcript: string;
  approvals: ApprovalRequestedEvent[];
  run: StartRunResult | null;
  busy: boolean;
  generatingGraph: boolean;
  expandingScopeId: string | null;
  startRun: (prompt: string) => Promise<void>;
  generateGraph: (scopeNodeId?: string) => Promise<void>;
  cancelRun: () => Promise<void>;
  respondApproval: (requestId: string, decision: "accept" | "decline") => Promise<void>;
};

export function useAgentSession(options: AgentSessionOptions): AgentSession {
  const bridge = useBridge();
  const { projectId, onGraphGenerated, onError, clearError } = options;
  const [providers, setProviders] = useState<ProviderInstallation[]>([]);
  const [providerKind, setProviderKind] = useState<ExecutableAgentProvider>("antigravity-cli");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [run, setRun] = useState<StartRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingGraph, setGeneratingGraph] = useState(false);
  const [expandingScopeId, setExpandingScopeId] = useState<string | null>(null);
  // The event subscription outlives any single project or callback identity, so
  // it reads both through refs instead of resubscribing on every change.
  const projectIdRef = useRef<string | null>(projectId);
  const generatedRef = useRef(onGraphGenerated);
  useEffect(() => {
    projectIdRef.current = projectId;
    generatedRef.current = onGraphGenerated;
  }, [projectId, onGraphGenerated]);

  useEffect(() => {
    void bridge
      .probeProviders()
      .then((installations) => {
        setProviders(installations);
        // Fall back to whichever provider is actually installed, rather than
        // presenting a default the machine cannot run.
        const usable = (kind: ExecutableAgentProvider) =>
          installations.some((item) => item.provider === kind && item.installed);
        if (!usable("antigravity-cli") && usable("codex")) setProviderKind("codex");
      })
      .catch(onError);
  }, [bridge, onError]);

  useEffect(() => {
    const offAgent = bridge.onAgentEvent((event) => {
      setEvents((current) => [...current.slice(-(MAX_RETAINED_EVENTS - 1)), event]);
      if (event.type === "run.completed" || event.type === "run.failed") {
        setBusy(false);
        setRun(null);
      }
    });

    const offGraph = bridge.onGraphGeneration((event: GraphGenerationEvent) => {
      setGeneratingGraph(false);
      setExpandingScopeId(null);
      setBusy(false);
      setRun(null);
      setEvents([]);
      if (event.status === "completed") {
        generatedRef.current(event.value, event.scopeNodeId ?? null);
      } else if (event.projectId === projectIdRef.current) {
        onError(event.message);
      }
    });

    return () => {
      offAgent();
      offGraph();
    };
  }, [bridge, onError]);

  const provider = providers.find((item) => item.provider === providerKind) ?? null;

  const transcript = useMemo(
    () =>
      events
        .filter((event) => event.type === "assistant.delta")
        .map((event) => event.text)
        .join(""),
    [events]
  );

  const approvals = useMemo(() => {
    const resolved = new Set(events.filter(isApprovalResolved).map((event) => event.requestId));
    return events.filter(isApprovalRequested).filter((event) => !resolved.has(event.requestId));
  }, [events]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const selectProvider = useCallback(
    (kind: ExecutableAgentProvider) => {
      setProviderKind(kind);
      setEvents([]);
      setRun(null);
      clearError();
    },
    [clearError]
  );

  const generateGraph = useCallback(
    async (scopeNodeId?: string) => {
      if (!projectId || !provider?.installed) return;
      setBusy(true);
      setGeneratingGraph(!scopeNodeId);
      setExpandingScopeId(scopeNodeId ?? null);
      clearError();
      setEvents([]);
      try {
        setRun(
          await bridge.generateFlowGraph({
            provider: providerKind,
            projectId,
            ...(scopeNodeId ? { scopeNodeId } : {}),
          })
        );
      } catch (reason) {
        setBusy(false);
        setGeneratingGraph(false);
        setExpandingScopeId(null);
        onError(reason);
      }
    },
    [bridge, clearError, onError, projectId, provider?.installed, providerKind]
  );

  const startRun = useCallback(
    async (prompt: string) => {
      if (!projectId || !prompt.trim()) return;
      setBusy(true);
      clearError();
      setEvents([]);
      try {
        setRun(await bridge.startAgentRun({ provider: providerKind, projectId, prompt }));
      } catch (reason) {
        setBusy(false);
        onError(reason);
      }
    },
    [bridge, clearError, onError, projectId, providerKind]
  );

  const cancelRun = useCallback(async () => {
    if (!projectId || !run) return;
    try {
      await bridge.cancelAgentRun({
        provider: providerKind,
        projectId,
        threadId: run.threadId,
        runId: run.runId,
      });
    } catch (reason) {
      onError(reason);
    }
  }, [bridge, onError, projectId, providerKind, run]);

  const respondApproval = useCallback(
    async (requestId: string, decision: "accept" | "decline") => {
      if (!projectId) return;
      try {
        await bridge.respondToAgentApproval({
          provider: "codex",
          projectId,
          requestId,
          decision,
        });
      } catch (reason) {
        onError(reason);
      }
    },
    [bridge, onError, projectId]
  );

  return {
    providers,
    provider,
    providerKind,
    meta: providerMeta[providerKind],
    selectProvider,
    events,
    clearEvents,
    transcript,
    approvals,
    run,
    busy,
    generatingGraph,
    expandingScopeId,
    startRun,
    generateGraph,
    cancelRun,
    respondApproval,
  };
}
