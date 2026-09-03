import { AGENT_PROVIDER_KINDS, type AgentEvent, type AgentProviderKind, type ApprovalDecision, type ProviderInstallation } from "@insightify/agent-runtime";
import { generatedFlowGraphSchema, type GeneratedFlowGraph } from "@insightify/graph-domain";
import { z } from "zod";

export const IPC_CHANNELS = {
  projectPick: "insightify:project:pick",
  projectList: "insightify:project:list",
  projectGraphGet: "insightify:project:graph:get",
  projectGraphSave: "insightify:project:graph:save",
  projectGraphFreshness: "insightify:project:graph:freshness",
  graphGenerate: "insightify:graph:generate",
  layoutGenerate: "insightify:layout:generate",
  graphGeneration: "insightify:graph:generation",
  providersProbe: "insightify:providers:probe",
  agentStartRun: "insightify:agent:run:start",
  agentCancelRun: "insightify:agent:run:cancel",
  agentApprovalRespond: "insightify:agent:approval:respond",
  agentEvent: "insightify:agent:event",
} as const;

export const projectIdSchema = z.string().uuid();
// Providers the desktop can launch as a subprocess. Deriving the list from
// AGENT_PROVIDER_KINDS means a provider added to the runtime is executable
// unless it is named here, rather than silently missing from the boundary.
const NON_EXECUTABLE_PROVIDERS = ["antigravity-sdk"] as const;

export type ExecutableAgentProvider = Exclude<
  AgentProviderKind,
  (typeof NON_EXECUTABLE_PROVIDERS)[number]
>;

export const executableAgentProviders = AGENT_PROVIDER_KINDS.filter(
  (kind): kind is ExecutableAgentProvider =>
    !(NON_EXECUTABLE_PROVIDERS as readonly string[]).includes(kind)
);

export const executableAgentProviderSchema = z.enum(executableAgentProviders);

export const startAgentRunInputSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
  prompt: z.string().trim().min(1).max(100_000),
});

export const projectGraphInputSchema = z.object({ projectId: projectIdSchema });

/**
 * Whether a saved graph still describes the project it was generated from.
 * `unknown` covers the cases where the question cannot be asked: no graph yet,
 * or a project directory that has gone away.
 */
export const graphFreshnessSchema = z.object({
  state: z.enum(["fresh", "stale", "unknown"]),
  checkedAt: z.string().min(1).max(64),
});
export type GraphFreshness = z.infer<typeof graphFreshnessSchema>;
export const saveProjectGraphInputSchema = generatedFlowGraphSchema.extend({
  provider: executableAgentProviderSchema,
});
export const regenerateLayoutInputSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
});

export const generateFlowGraphInputSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
  scopeNodeId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).optional(),
});

export const cancelAgentRunInputSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
  threadId: z.string().min(1),
  runId: z.string().min(1),
});

export const approvalResponseSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
  requestId: z.string().min(1),
  decision: z.enum(["accept", "acceptForSession", "decline", "cancel"]),
});

export type StartAgentRunInput = z.infer<typeof startAgentRunInputSchema>;
export type CancelAgentRunInput = z.infer<typeof cancelAgentRunInputSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema> & { decision: ApprovalDecision };
export type GenerateFlowGraphInput = z.infer<typeof generateFlowGraphInputSchema>;
export type RegenerateLayoutInput = z.infer<typeof regenerateLayoutInputSchema>;

// What a finished run produced. The renderer reacts differently to each: a new
// graph returns the canvas to the root, while an expansion or a relayout leaves
// the user where they were standing.
export type GenerationMode = "graph" | "expansion" | "layout";

export type GraphGenerationEvent =
  | { status: "completed"; mode: GenerationMode; value: GeneratedFlowGraph; scopeNodeId?: string }
  | {
      status: "failed";
      mode: GenerationMode;
      projectId: string;
      provider: ExecutableAgentProvider;
      scopeNodeId?: string;
      message: string;
    };

export type ProjectSummary = {
  id: string;
  displayName: string;
  lastOpenedAt: string;
  canonicalPath?: string;
  sandboxPath?: string;
};

export type StartRunResult = {
  threadId: string;
  runId: string;
};

export interface InsightifyDesktopApi {
  pickProject(): Promise<ProjectSummary | null>;
  listProjects(): Promise<ProjectSummary[]>;
  getProjectGraph(projectId: string): Promise<GeneratedFlowGraph | null>;
  saveProjectGraph(value: GeneratedFlowGraph): Promise<GeneratedFlowGraph>;
  checkGraphFreshness(projectId: string): Promise<GraphFreshness>;
  probeProviders(): Promise<ProviderInstallation[]>;
  startAgentRun(input: StartAgentRunInput): Promise<StartRunResult>;
  generateFlowGraph(input: GenerateFlowGraphInput): Promise<StartRunResult>;
  regenerateLayout(input: RegenerateLayoutInput): Promise<StartRunResult>;
  cancelAgentRun(input: CancelAgentRunInput): Promise<void>;
  respondToAgentApproval(input: ApprovalResponse): Promise<void>;
  onAgentEvent(listener: (event: AgentEvent) => void): () => void;
  onGraphGeneration(listener: (event: GraphGenerationEvent) => void): () => void;
}
