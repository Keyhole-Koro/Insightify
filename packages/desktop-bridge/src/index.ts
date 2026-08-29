import type { AgentEvent, ApprovalDecision, ProviderInstallation } from "@insightify/agent-runtime";
import { generatedFlowGraphSchema, type GeneratedFlowGraph } from "@insightify/graph-domain";
import { z } from "zod";

export const IPC_CHANNELS = {
  projectPick: "insightify:project:pick",
  projectList: "insightify:project:list",
  projectGraphGet: "insightify:project:graph:get",
  projectGraphSave: "insightify:project:graph:save",
  graphGenerate: "insightify:graph:generate",
  graphGeneration: "insightify:graph:generation",
  providersProbe: "insightify:providers:probe",
  agentStartRun: "insightify:agent:run:start",
  agentCancelRun: "insightify:agent:run:cancel",
  agentApprovalRespond: "insightify:agent:approval:respond",
  agentEvent: "insightify:agent:event",
} as const;

export const projectIdSchema = z.string().uuid();
export const executableAgentProviderSchema = z.enum(["codex", "antigravity-cli"]);

export const startAgentRunInputSchema = z.object({
  provider: executableAgentProviderSchema,
  projectId: projectIdSchema,
  prompt: z.string().trim().min(1).max(100_000),
});

export const projectGraphInputSchema = z.object({ projectId: projectIdSchema });
export const saveProjectGraphInputSchema = generatedFlowGraphSchema;
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

export type ExecutableAgentProvider = z.infer<typeof executableAgentProviderSchema>;
export type StartAgentRunInput = z.infer<typeof startAgentRunInputSchema>;
export type CancelAgentRunInput = z.infer<typeof cancelAgentRunInputSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema> & { decision: ApprovalDecision };
export type GenerateFlowGraphInput = z.infer<typeof generateFlowGraphInputSchema>;

export type GraphGenerationEvent =
  | { status: "completed"; value: GeneratedFlowGraph; scopeNodeId?: string }
  | { status: "failed"; projectId: string; provider: ExecutableAgentProvider; scopeNodeId?: string; message: string };

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
  probeProviders(): Promise<ProviderInstallation[]>;
  startAgentRun(input: StartAgentRunInput): Promise<StartRunResult>;
  generateFlowGraph(input: GenerateFlowGraphInput): Promise<StartRunResult>;
  cancelAgentRun(input: CancelAgentRunInput): Promise<void>;
  respondToAgentApproval(input: ApprovalResponse): Promise<void>;
  onAgentEvent(listener: (event: AgentEvent) => void): () => void;
  onGraphGeneration(listener: (event: GraphGenerationEvent) => void): () => void;
}
