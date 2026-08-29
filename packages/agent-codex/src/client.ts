import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import { promisify } from "node:util";
import type { AgentEvent, ApprovalDecision, ProviderInstallation } from "@insightify/agent-runtime";
import { codexCapabilities } from "@insightify/agent-runtime";
import { normalizeCodexNotification, normalizeCodexServerRequest } from "./normalize.js";
import {
  isRecord,
  parseJsonLine,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcResponse,
  type JsonRpcServerRequest,
} from "./protocol.js";

const execFileAsync = promisify(execFile);

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

const RPC_TIMEOUT_MS = 20_000;

type CodexClientOptions = {
  projectId: string;
  cwd: string;
  executable?: string;
  version?: string | null;
};

export type CodexRunHandle = {
  threadId: string;
  runId: string;
};

export type CodexRunOptions = {
  cwd?: string;
  outputSchema?: unknown;
  readOnly?: boolean;
};

export async function probeCodex(executable = "codex"): Promise<ProviderInstallation> {
  try {
    const { stdout, stderr } = await execFileAsync(executable, ["--version"], { timeout: 5_000 });
    const output = `${stdout}\n${stderr}`.trim();
    return {
      provider: "codex",
      installed: true,
      version: output || null,
      error: null,
      capabilities: codexCapabilities(),
    };
  } catch (error) {
    return {
      provider: "codex",
      installed: false,
      version: null,
      error: error instanceof Error ? error.message : String(error),
      capabilities: codexCapabilities(),
    };
  }
}

export class CodexAppServerClient {
  readonly #projectId: string;
  readonly #cwd: string;
  readonly #executable: string;
  readonly #version: string | null;
  readonly #events = new EventEmitter();
  readonly #pending = new Map<JsonRpcId, PendingRequest>();
  #process: ChildProcessWithoutNullStreams | null = null;
  #nextRequestId = 1;
  #sequence = 0;
  #connecting: Promise<void> | null = null;

  constructor(options: CodexClientOptions) {
    this.#projectId = options.projectId;
    this.#cwd = options.cwd;
    this.#executable = options.executable ?? "codex";
    this.#version = options.version ?? null;
  }

  onEvent(listener: (event: AgentEvent) => void): () => void {
    this.#events.on("event", listener);
    return () => this.#events.off("event", listener);
  }

  async connect(): Promise<void> {
    if (this.#process) return;
    if (this.#connecting) return this.#connecting;
    this.#connecting = this.#connectOnce();
    try {
      await this.#connecting;
    } catch (error) {
      await this.stop();
      throw error;
    } finally {
      this.#connecting = null;
    }
  }

  async #connectOnce(): Promise<void> {
    const child = spawn(this.#executable, ["app-server"], {
      cwd: this.#cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.#process = child;

    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.#handleLine(line));
    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (message) this.#emitWarning(message);
    });
    child.once("exit", (code, signal) => this.#handleExit(code, signal));
    child.once("error", (error) => this.#handleProcessError(error));

    await this.#request("initialize", {
      clientInfo: {
        name: "insightify_desktop",
        title: "Insightify Desktop",
        version: "0.0.1",
      },
      capabilities: null,
    });
    this.#notify("initialized", {});
    this.#emit({
      provider: "codex",
      projectId: this.#projectId,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
      threadId: null,
      runId: null,
      type: "provider.connected",
      version: this.#version,
    });
  }

  async startRun(prompt: string, options: CodexRunOptions = {}): Promise<CodexRunHandle> {
    await this.connect();
    const runCwd = options.cwd ?? this.#cwd;
    const approvalPolicy = options.readOnly ? "never" : "on-request";
    const threadResult = await this.#request("thread/start", {
      cwd: runCwd,
      approvalPolicy,
      sandbox: options.readOnly ? "read-only" : "workspace-write",
      serviceName: "insightify_desktop",
    });
    const thread = isRecord(threadResult) ? threadResult.thread : null;
    const threadId = isRecord(thread) && typeof thread.id === "string" ? thread.id : null;
    if (!threadId) throw new Error("Codex thread/start response did not contain a thread id");

    const turnResult = await this.#request("turn/start", {
      threadId,
      input: [{ type: "text", text: prompt }],
      cwd: runCwd,
      approvalPolicy,
      sandboxPolicy: options.readOnly
        ? {
            type: "readOnly",
            networkAccess: false,
          }
        : {
            type: "workspaceWrite",
            writableRoots: [runCwd],
            networkAccess: false,
            excludeTmpdirEnvVar: false,
            excludeSlashTmp: false,
          },
      ...(options.outputSchema === undefined ? {} : { outputSchema: options.outputSchema }),
    });
    const turn = isRecord(turnResult) ? turnResult.turn : null;
    const runId = isRecord(turn) && typeof turn.id === "string" ? turn.id : null;
    if (!runId) throw new Error("Codex turn/start response did not contain a turn id");
    return { threadId, runId };
  }

  async cancelRun(threadId: string, runId: string): Promise<void> {
    await this.#request("turn/interrupt", { threadId, turnId: runId });
  }

  respondToApproval(requestId: string, decision: ApprovalDecision): void {
    const numericId = Number(requestId);
    const id: JsonRpcId = Number.isSafeInteger(numericId) && String(numericId) === requestId ? numericId : requestId;
    this.#write({ id, result: { decision } });
  }

  async stop(): Promise<void> {
    const child = this.#process;
    if (!child) return;
    child.stdin.end();
    if (child.exitCode === null) child.kill("SIGTERM");
    this.#disconnect("Codex app-server stopped");
  }

  async #request(method: string, params?: unknown): Promise<unknown> {
    const id = this.#nextRequestId++;
    const result = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`Codex RPC timed out: ${method}`));
      }, RPC_TIMEOUT_MS);
      this.#pending.set(id, { resolve, reject, timeout });
    });
    try {
      this.#write({ method, id, ...(params === undefined ? {} : { params }) });
    } catch (error) {
      const pending = this.#pending.get(id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.#pending.delete(id);
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return result;
  }

  #notify(method: string, params?: unknown): void {
    this.#write({ method, ...(params === undefined ? {} : { params }) });
  }

  #write(message: unknown): void {
    const child = this.#process;
    if (!child || child.stdin.destroyed) throw new Error("Codex app-server is not connected");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #handleLine(line: string): void {
    let message;
    try {
      message = parseJsonLine(line);
    } catch (error) {
      this.#emitWarning(error instanceof Error ? error.message : String(error));
      return;
    }

    if ("method" in message && "id" in message) {
      const events = normalizeCodexServerRequest(message as JsonRpcServerRequest, {
        projectId: this.#projectId,
        sequence: ++this.#sequence,
      });
      events.forEach((event) => this.#emit(event));
      return;
    }

    if ("method" in message) {
      const events = normalizeCodexNotification(message as JsonRpcNotification, {
        projectId: this.#projectId,
        sequence: ++this.#sequence,
      });
      events.forEach((event) => this.#emit(event));
      return;
    }

    const response = message as JsonRpcResponse;
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timeout);
    if (response.error) {
      pending.reject(new Error(`Codex RPC ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  #handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (!this.#process) return;
    const reason = `Codex app-server exited (${signal ?? code ?? "unknown"})`;
    this.#disconnect(reason);
  }

  #handleProcessError(error: Error): void {
    this.#emitWarning(error.message);
    this.#disconnect(`Codex app-server failed: ${error.message}`);
  }

  #disconnect(reason: string): void {
    if (!this.#process) return;
    this.#process = null;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.#pending.clear();
    this.#emit({
      provider: "codex",
      projectId: this.#projectId,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
      threadId: null,
      runId: null,
      type: "provider.disconnected",
      reason,
    });
  }

  #emitWarning(message: string): void {
    this.#emit({
      provider: "codex",
      projectId: this.#projectId,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
      threadId: null,
      runId: null,
      type: "warning",
      message,
    });
  }

  #emit(event: AgentEvent): void {
    this.#events.emit("event", event);
  }
}
