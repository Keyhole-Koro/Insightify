import {
  dialog,
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron";
import { inspect } from "node:util";
import {
  approvalResponseSchema,
  cancelAgentRunInputSchema,
  generateFlowGraphInputSchema,
  regenerateLayoutInputSchema,
  IPC_CHANNELS,
  startAgentRunInputSchema,
  projectGraphInputSchema,
  saveProjectGraphInputSchema,
} from "@insightify/desktop-bridge";
import type { AgentRuntimeManager } from "./agent-runtime-manager.js";
import type { ProjectRepository } from "./project-repository.js";

type RegisterIpcOptions = {
  projects: ProjectRepository;
  agents: AgentRuntimeManager;
  window: () => BrowserWindow | null;
};

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/**
 * Electron only forwards an ipcMain.handle error's message to the renderer.
 * Log the full value in the main process and put the useful stack in that
 * message as well, so a packaged build still has actionable diagnostics.
 */
function handleIpc(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const timestamp = new Date().toISOString();
      const inspected = error instanceof Error
        ? error.stack ?? `${error.name}: ${error.message}`
        : inspect(error, { depth: 6, breakLength: 120 });
      console.error(`[Insightify IPC ${timestamp}] ${channel} failed\n${inspected}`, {
        argumentTypes: args.map((value) =>
          value === null ? "null" : Array.isArray(value) ? "array" : typeof value
        ),
        senderUrl: event.senderFrame?.url ?? event.sender.getURL(),
      });
      throw new Error(`[IPC ${channel}] ${inspected}`);
    }
  });
}

export function registerIpc(options: RegisterIpcOptions): () => void {
  handleIpc(IPC_CHANNELS.projectPick, async () => {
    let stage = "opening native directory dialog";
    try {
      const dialogOptions: OpenDialogOptions = {
        title: "Open an Insightify project",
        properties: ["openDirectory"],
      };
      const result = await dialog.showOpenDialog(dialogOptions);
      if (result.canceled || result.filePaths.length === 0) return null;

      stage = "registering project and creating sandbox copy";
      const project = options.projects.openPath(result.filePaths[0]);
      stage = "preparing ProjectSummary for renderer";
      const summary = {
        id: project.id,
        displayName: project.displayName,
        lastOpenedAt: project.lastOpenedAt,
      };
      // Fail here with a named stage instead of Electron's opaque clone error.
      structuredClone(summary);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : inspect(error, { depth: 4 });
      throw new Error(`Open Project failed while ${stage}: ${message}`, { cause: error });
    }
  });

  handleIpc(IPC_CHANNELS.projectList, () => options.projects.list());
  handleIpc(IPC_CHANNELS.projectGraphGet, (_event, raw: unknown) => {
    const input = projectGraphInputSchema.parse(raw);
    return options.projects.getGraph(input.projectId);
  });
  handleIpc(IPC_CHANNELS.projectGraphSave, (_event, raw: unknown) => {
    const value = saveProjectGraphInputSchema.parse(raw);
    if (!options.projects.resolve(value.projectId)) throw new Error("Unknown project id");
    options.projects.saveGraph(value);
    return value;
  });
  handleIpc(IPC_CHANNELS.projectGraphFreshness, async (_event, raw: unknown) => {
    const input = projectGraphInputSchema.parse(raw);
    return options.agents.checkGraphFreshness(input.projectId);
  });
  handleIpc(IPC_CHANNELS.providersProbe, () => options.agents.probeProviders());
  handleIpc(IPC_CHANNELS.agentStartRun, async (_event, raw: unknown) => {
    const input = startAgentRunInputSchema.parse(raw);
    return options.agents.startRun(input.provider, input.projectId, input.prompt);
  });
  handleIpc(IPC_CHANNELS.graphGenerate, async (_event, raw: unknown) => {
    const input = generateFlowGraphInputSchema.parse(raw);
    return options.agents.generateGraph(input.provider, input.projectId, input.scopeNodeId);
  });
  handleIpc(IPC_CHANNELS.layoutGenerate, async (_event, raw: unknown) => {
    const input = regenerateLayoutInputSchema.parse(raw);
    return options.agents.regenerateLayout(input.provider, input.projectId);
  });
  handleIpc(IPC_CHANNELS.agentCancelRun, async (_event, raw: unknown) => {
    const input = cancelAgentRunInputSchema.parse(raw);
    await options.agents.cancelRun(input.provider, input.projectId, input.threadId, input.runId);
  });
  handleIpc(IPC_CHANNELS.agentApprovalRespond, async (_event, raw: unknown) => {
    const input = approvalResponseSchema.parse(raw);
    await options.agents.respondToApproval(input.provider, input.projectId, input.requestId, input.decision);
  });

  return () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
      if (channel !== IPC_CHANNELS.agentEvent && channel !== IPC_CHANNELS.graphGeneration) {
        ipcMain.removeHandler(channel);
      }
    }
  };
}
