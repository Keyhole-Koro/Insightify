import type { BrowserWindow } from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AntigravityCliClient, probeAntigravity } from "@insightify/agent-antigravity-cli";
import { CodexAppServerClient, probeCodex } from "@insightify/agent-codex";
import type { AgentEvent, ApprovalDecision, ProviderInstallation } from "@insightify/agent-runtime";
import {
  IPC_CHANNELS,
  type ExecutableAgentProvider,
  type GenerationMode,
  type StartRunResult,
} from "@insightify/desktop-bridge";
import {
  FLOW_GRAPH_GENERATION_JSON_SCHEMA,
  SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA,
  defaultRoomLayoutRules,
  parseSemanticLayoutPlan,
  parseSemanticLayoutPlanText,
  withLayoutPlan,
  isRoom,
  LAYOUT_ENGINE_VERSION,
  FLOW_GRAPH_GENERATION_EXPANSION_JSON_SCHEMA,
  applyScopeExpansion,
  balanceFlowGraphScopes,
  createDefaultGraphLayout,
  mergeSemanticLayoutScopes,
  parseFlowGraphGeneration,
  parseFlowGraphGenerationExpansion,
  parseFlowGraphGenerationExpansionText,
  parseFlowGraphGenerationText,
  resolveRoomLayoutRules,
  type FlowGraph,
  type GeneratedFlowGraph,
  type SemanticLayoutPlan,
} from "@insightify/graph-domain";
import type { ProjectRepository } from "./project-repository.js";
import {
  buildFlowGraphExpansionPrompt,
  buildFlowGraphPrompt,
  buildLayoutPlanPrompt,
  buildProjectSnapshot,
} from "./project-snapshot.js";

type CodexSession = { client: CodexAppServerClient; unsubscribe: () => void };
type AntigravitySession = { client: AntigravityCliClient; unsubscribe: () => void };
type GraphGeneration = {
  mode: GenerationMode;
  projectId: string;
  provider: ExecutableAgentProvider;
  runId: string | null;
  snapshotHash: string;
  transcript: string;
  structuredOutput: unknown;
  temporaryDirectory: string | null;
  scopeNodeId: string | null;
  existingGraph: FlowGraph | null;
  existingLayout: GeneratedFlowGraph["layout"];
  existingLayoutOverrides: GeneratedFlowGraph["layoutOverrides"];
  existingLayoutPlan: SemanticLayoutPlan | undefined;
};

export class AgentRuntimeManager {
  readonly #projects: ProjectRepository;
  readonly #window: () => BrowserWindow | null;
  readonly #codexSessions = new Map<string, CodexSession>();
  readonly #antigravitySessions = new Map<string, AntigravitySession>();
  readonly #installations = new Map<ExecutableAgentProvider, ProviderInstallation>();
  readonly #graphGenerations: GraphGeneration[] = [];

  constructor(projects: ProjectRepository, window: () => BrowserWindow | null) {
    this.#projects = projects;
    this.#window = window;
  }

  async probeProviders(): Promise<ProviderInstallation[]> {
    const installations = await Promise.all([probeCodex(), probeAntigravity()]);
    for (const installation of installations) {
      if (installation.provider === "codex" || installation.provider === "antigravity-cli") {
        this.#installations.set(installation.provider, installation);
      }
    }
    return installations;
  }

  async startRun(provider: ExecutableAgentProvider, projectId: string, prompt: string): Promise<StartRunResult> {
    if (provider === "codex") return (await this.#codexFor(projectId)).startRun(prompt);
    return (await this.#antigravityFor(projectId)).startRun(prompt);
  }

  async generateGraph(provider: ExecutableAgentProvider, projectId: string, scopeNodeId?: string): Promise<StartRunResult> {
    if (this.#graphGenerations.some((item) => item.projectId === projectId)) {
      throw new Error("A graph generation is already running for this project");
    }
    const project = this.#requireProject(projectId);
    const currentDocument = scopeNodeId ? this.#projects.getGraph(projectId) : null;
    if (scopeNodeId && !currentDocument) throw new Error("Generate the root FlowFold Graph before expanding a Room");
    const snapshot = await buildProjectSnapshot(project.canonicalPath);
    const prompt = scopeNodeId
      ? buildFlowGraphExpansionPrompt(snapshot, currentDocument!.graph, scopeNodeId, currentDocument!.layoutPlan)
      : buildFlowGraphPrompt(snapshot);
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "insightify-graph-"));
    const generation: GraphGeneration = {
      mode: scopeNodeId ? "expansion" : "graph",
      projectId,
      provider,
      runId: null,
      snapshotHash: snapshot.hash,
      transcript: "",
      structuredOutput: null,
      temporaryDirectory,
      scopeNodeId: scopeNodeId ?? null,
      existingGraph: currentDocument?.graph ?? null,
      existingLayout: currentDocument?.layout ?? {},
      existingLayoutOverrides: currentDocument?.layoutOverrides,
      existingLayoutPlan: currentDocument?.layoutPlan,
    };
    this.#graphGenerations.push(generation);

    try {
      const handle = provider === "codex"
        ? await (await this.#codexFor(projectId)).startRun(prompt, {
            outputSchema: scopeNodeId
              ? FLOW_GRAPH_GENERATION_EXPANSION_JSON_SCHEMA
              : FLOW_GRAPH_GENERATION_JSON_SCHEMA,
          readOnly: true,
          cwd: temporaryDirectory,
          })
        : await (await this.#antigravityFor(projectId)).startRun(prompt, {
            cwd: temporaryDirectory ?? undefined,
            jsonSchema: scopeNodeId
              ? FLOW_GRAPH_GENERATION_EXPANSION_JSON_SCHEMA
              : FLOW_GRAPH_GENERATION_JSON_SCHEMA,
          });
      generation.runId = handle.runId;
      return handle;
    } catch (error) {
      this.#removeGeneration(generation);
      this.#sendGraphEvent({
        status: "failed",
        mode: generation.mode,
        projectId,
        provider,
        ...(scopeNodeId ? { scopeNodeId } : {}),
        message: toMessage(error),
      });
      throw error;
    }
  }

  /**
   * Rebuilds only the arrangement. The graph, its evidence and every hand-placed
   * position are left alone, so this run is cheap and cannot lose work: it needs
   * no project snapshot, only the nodes it has to group.
   */
  async regenerateLayout(provider: ExecutableAgentProvider, projectId: string): Promise<StartRunResult> {
    if (this.#graphGenerations.some((item) => item.projectId === projectId)) {
      throw new Error("A graph generation is already running for this project");
    }
    this.#requireProject(projectId);
    const currentDocument = this.#projects.getGraph(projectId);
    if (!currentDocument) throw new Error("Generate the FlowFold Graph before regenerating its layout");

    const prompt = buildLayoutPlanPrompt(currentDocument.graph, currentDocument.layoutPlan);
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "insightify-layout-"));
    const generation: GraphGeneration = {
      mode: "layout",
      projectId,
      provider,
      runId: null,
      snapshotHash: currentDocument.snapshotHash,
      transcript: "",
      structuredOutput: null,
      temporaryDirectory,
      scopeNodeId: null,
      existingGraph: currentDocument.graph,
      existingLayout: currentDocument.layout,
      existingLayoutOverrides: currentDocument.layoutOverrides,
      existingLayoutPlan: currentDocument.layoutPlan,
    };
    this.#graphGenerations.push(generation);

    try {
      const handle = provider === "codex"
        ? await (await this.#codexFor(projectId)).startRun(prompt, {
            outputSchema: SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA,
            readOnly: true,
            cwd: temporaryDirectory,
          })
        : await (await this.#antigravityFor(projectId)).startRun(prompt, {
            cwd: temporaryDirectory,
            jsonSchema: SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA,
          });
      generation.runId = handle.runId;
      return handle;
    } catch (error) {
      this.#removeGeneration(generation);
      this.#sendGraphEvent({
        status: "failed",
        mode: "layout",
        projectId,
        provider,
        message: toMessage(error),
      });
      throw error;
    }
  }

  async cancelRun(
    provider: ExecutableAgentProvider,
    projectId: string,
    threadId: string,
    runId: string,
  ): Promise<void> {
    if (provider === "codex") {
      await (await this.#codexFor(projectId)).cancelRun(threadId, runId);
      return;
    }
    await (await this.#antigravityFor(projectId)).cancelRun(runId);
  }

  async respondToApproval(
    provider: ExecutableAgentProvider,
    projectId: string,
    requestId: string,
    decision: ApprovalDecision,
  ): Promise<void> {
    if (provider !== "codex") throw new Error("Antigravity CLI headless runs do not support interactive approvals");
    (await this.#codexFor(projectId)).respondToApproval(requestId, decision);
  }

  async stop(): Promise<void> {
    const codex = [...this.#codexSessions.values()];
    const antigravity = [...this.#antigravitySessions.values()];
    this.#codexSessions.clear();
    this.#antigravitySessions.clear();
    for (const generation of [...this.#graphGenerations]) this.#removeGeneration(generation);
    await Promise.all([
      ...codex.map(async ({ client, unsubscribe }) => { unsubscribe(); await client.stop(); }),
      ...antigravity.map(async ({ client, unsubscribe }) => { unsubscribe(); await client.stop(); }),
    ]);
  }

  async #codexFor(projectId: string): Promise<CodexAppServerClient> {
    const existing = this.#codexSessions.get(projectId);
    if (existing) return existing.client;
    const project = this.#requireProject(projectId);
    const installation = await this.#installation("codex");
    const workingCwd = project.sandboxPath || project.canonicalPath;
    const client = new CodexAppServerClient({ projectId, cwd: workingCwd, version: installation.version });
    const unsubscribe = client.onEvent((event) => this.#forward(event));
    this.#codexSessions.set(projectId, { client, unsubscribe });
    return client;
  }

  async #antigravityFor(projectId: string): Promise<AntigravityCliClient> {
    const existing = this.#antigravitySessions.get(projectId);
    if (existing) return existing.client;
    const project = this.#requireProject(projectId);
    const installation = await this.#installation("antigravity-cli");
    const workingCwd = project.sandboxPath || project.canonicalPath;
    const client = new AntigravityCliClient({ projectId, cwd: workingCwd, version: installation.version });
    const unsubscribe = client.onEvent((event) => this.#forward(event));
    this.#antigravitySessions.set(projectId, { client, unsubscribe });
    return client;
  }

  #requireProject(projectId: string) {
    const project = this.#projects.resolve(projectId);
    if (!project) throw new Error("Unknown project id");
    return project;
  }

  async #installation(provider: ExecutableAgentProvider): Promise<ProviderInstallation> {
    const cached = this.#installations.get(provider);
    const installation = cached ?? (provider === "codex" ? await probeCodex() : await probeAntigravity());
    this.#installations.set(provider, installation);
    if (!installation.installed) {
      const label = provider === "codex" ? "Codex" : "Antigravity";
      throw new Error(installation.error ?? `${label} CLI is not installed`);
    }
    return installation;
  }

  #forward(event: AgentEvent): void {
    const generation = this.#graphGenerations.find((item) =>
      item.projectId === event.projectId
      && item.provider === event.provider
      && (item.runId === null || event.runId === item.runId),
    );
    if (generation) {
      if (event.type === "assistant.delta") generation.transcript += event.text;
      if (event.type === "provider.event" && event.method === "result") {
        const message = asRecord(event.payload);
        generation.structuredOutput = asRecord(message.result).structured_output ?? null;
      }
      if (event.type === "run.completed") this.#completeGeneration(generation, event.status);
      if (event.type === "run.failed") this.#failGeneration(generation, event.message);
    }
    const window = this.#window();
    if (!window || window.isDestroyed()) return;
    window.webContents.send(IPC_CHANNELS.agentEvent, event);
  }

  #completeGeneration(generation: GraphGeneration, status: "completed" | "interrupted"): void {
    if (status === "interrupted") {
      this.#failGeneration(generation, "Graph generation was interrupted");
      return;
    }
    try {
      if (generation.mode === "layout") {
        this.#completeLayoutGeneration(generation);
        return;
      }
      let generatedGraph: FlowGraph;
      let layoutPlan: SemanticLayoutPlan;
      if (generation.scopeNodeId && generation.existingGraph) {
        const expansion = generation.structuredOutput === null
          ? parseFlowGraphGenerationExpansionText(generation.transcript)
          : parseFlowGraphGenerationExpansion(generation.structuredOutput);
        generatedGraph = applyScopeExpansion(
          generation.existingGraph,
          { nodes: expansion.nodes, edges: expansion.edges },
          generation.scopeNodeId
        );
        const existingIds = new Set(generation.existingGraph.nodes.map((node) => node.id));
        const newRoomIds = generatedGraph.nodes
          .filter((node) => isRoom(node) && !existingIds.has(node.id))
          .map((node) => node.id);
        layoutPlan = mergeSemanticLayoutScopes(
          generatedGraph,
          generation.existingLayoutPlan,
          expansion.layoutScopes,
          new Set([generation.scopeNodeId, ...newRoomIds])
        );
      } else {
        const generated = generation.structuredOutput === null
          ? parseFlowGraphGenerationText(generation.transcript)
          : parseFlowGraphGeneration(generation.structuredOutput);
        generatedGraph = generated.graph;
        layoutPlan = generated.layoutPlan;
      }
      const graph = balanceFlowGraphScopes(generatedGraph);
      const layoutRules = resolveRoomLayoutRules(graph, layoutPlan);
      const value: GeneratedFlowGraph = {
        projectId: generation.projectId,
        provider: generation.provider,
        snapshotHash: generation.snapshotHash,
        generatedAt: new Date().toISOString(),
        graph,
        layoutPlan,
        layout: createDefaultGraphLayout(graph, generation.existingLayout, layoutRules),
        ...(generation.existingLayoutOverrides
          ? { layoutOverrides: generation.existingLayoutOverrides }
          : {}),
        layoutEngineVersion: LAYOUT_ENGINE_VERSION,
      };
      this.#projects.saveGraph(value);
      this.#sendGraphEvent({
        status: "completed",
        mode: generation.mode,
        value,
        ...(generation.scopeNodeId ? { scopeNodeId: generation.scopeNodeId } : {}),
      });
    } catch (error) {
      this.#sendGraphEvent({
        status: "failed",
        mode: generation.mode,
        projectId: generation.projectId,
        provider: generation.provider,
        ...(generation.scopeNodeId ? { scopeNodeId: generation.scopeNodeId } : {}),
        message: generation.mode === "layout"
          ? `The provider returned an invalid layout plan: ${toMessage(error)}`
          : `The provider returned an invalid FlowFold graph: ${toMessage(error)}`,
      });
    } finally {
      this.#removeGeneration(generation);
    }
  }

  #completeLayoutGeneration(generation: GraphGeneration): void {
    const current = this.#projects.getGraph(generation.projectId);
    if (!current) throw new Error("The project graph disappeared while its layout was being generated");
    const layoutPlan = generation.structuredOutput === null
      ? parseSemanticLayoutPlanText(generation.transcript)
      : parseSemanticLayoutPlan(generation.structuredOutput);
    // A plan that names no node of this graph would silently fall back to the
    // built-in rules, which is not what the user asked for.
    if (resolveRoomLayoutRules(current.graph, layoutPlan) === defaultRoomLayoutRules) {
      throw new Error("The plan did not describe any node of this graph");
    }
    const value = withLayoutPlan(current, layoutPlan);
    this.#projects.saveGraph(value);
    this.#sendGraphEvent({ status: "completed", mode: "layout", value });
  }

  #failGeneration(generation: GraphGeneration, message: string): void {
    this.#sendGraphEvent({
      status: "failed",
      mode: generation.mode,
      projectId: generation.projectId,
      provider: generation.provider,
      ...(generation.scopeNodeId ? { scopeNodeId: generation.scopeNodeId } : {}),
      message,
    });
    this.#removeGeneration(generation);
  }

  #removeGeneration(generation: GraphGeneration): void {
    const index = this.#graphGenerations.indexOf(generation);
    if (index >= 0) this.#graphGenerations.splice(index, 1);
    if (generation.temporaryDirectory) {
      void rm(generation.temporaryDirectory, { recursive: true, force: true });
    }
  }

  #sendGraphEvent(event: import("@insightify/desktop-bridge").GraphGenerationEvent): void {
    const window = this.#window();
    if (!window || window.isDestroyed()) return;
    window.webContents.send(IPC_CHANNELS.graphGeneration, event);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
