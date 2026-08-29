import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import { promisify } from "node:util";
import type { AgentEvent, ProviderInstallation } from "@insightify/agent-runtime";
import { antigravityCliCapabilities } from "@insightify/agent-runtime";
import { normalizeAntigravityEvent, parseAntigravityLine } from "./normalize.js";

const execFileAsync = promisify(execFile);

type AntigravityClientOptions = {
  projectId: string;
  cwd: string;
  executable?: string;
  version?: string | null;
};

type ActiveRun = {
  child: ChildProcessWithoutNullStreams;
  threadId: string;
  canceled: boolean;
  terminal: boolean;
};

type AgentEventBaseKey = "provider" | "projectId" | "sequence" | "timestamp" | "threadId" | "runId";
type WithoutAgentEventBase<T> = T extends AgentEvent ? Omit<T, AgentEventBaseKey> : never;
type AgentEventPayload = WithoutAgentEventBase<AgentEvent>;

export type AntigravityRunHandle = {
  threadId: string;
  runId: string;
};

export type AntigravityRunOptions = {
  cwd?: string;
  jsonSchema?: unknown;
};

export async function probeAntigravity(executable = "agy"): Promise<ProviderInstallation> {
  try {
    const { stdout, stderr } = await execFileAsync(executable, ["--version"], { timeout: 5_000 });
    const output = `${stdout}\n${stderr}`.trim();
    return {
      provider: "antigravity-cli",
      installed: true,
      version: output || null,
      error: null,
      capabilities: antigravityCliCapabilities(),
    };
  } catch (error) {
    return {
      provider: "antigravity-cli",
      installed: false,
      version: null,
      error: error instanceof Error ? error.message : String(error),
      capabilities: antigravityCliCapabilities(),
    };
  }
}

export class AntigravityCliClient {
  readonly #projectId: string;
  readonly #cwd: string;
  readonly #executable: string;
  readonly #version: string | null;
  readonly #events = new EventEmitter();
  readonly #runs = new Map<string, ActiveRun>();
  #sequence = 0;

  constructor(options: AntigravityClientOptions) {
    this.#projectId = options.projectId;
    this.#cwd = options.cwd;
    this.#executable = options.executable ?? "agy";
    this.#version = options.version ?? null;
  }

  onEvent(listener: (event: AgentEvent) => void): () => void {
    this.#events.on("event", listener);
    return () => this.#events.off("event", listener);
  }

  async startRun(prompt: string, options: AntigravityRunOptions = {}): Promise<AntigravityRunHandle> {
    const runId = randomUUID();
    const threadId = runId;
    const args = ["-p", prompt, "--output-format", "stream-json", "--sandbox"];
    if (options.jsonSchema !== undefined) args.push("--json-schema", JSON.stringify(options.jsonSchema));
    const child = spawn(
      this.#executable,
      args,
      { cwd: options.cwd ?? this.#cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    const active: ActiveRun = { child, threadId, canceled: false, terminal: false };
    this.#runs.set(runId, active);

    readline.createInterface({ input: child.stdout }).on("line", (line) => {
      try {
        const events = normalizeAntigravityEvent(parseAntigravityLine(line), {
          projectId: this.#projectId,
          threadId,
          runId,
          nextSequence: () => ++this.#sequence,
        });
        for (const event of events) {
          if (event.type === "run.completed" || event.type === "run.failed") active.terminal = true;
          this.#emit(event);
        }
      } catch (error) {
        this.#warning(threadId, runId, error instanceof Error ? error.message : String(error));
      }
    });
    readline.createInterface({ input: child.stderr }).on("line", (line) => {
      if (line.trim()) this.#warning(threadId, runId, line.trim());
    });
    child.once("exit", (code, signal) => this.#handleExit(runId, code, signal));

    await new Promise<void>((resolve, reject) => {
      const onStartError = (error: Error) => {
        this.#runs.delete(runId);
        reject(error);
      };
      child.once("error", onStartError);
      child.once("spawn", () => {
        child.off("error", onStartError);
        this.#emitBase(threadId, runId, { type: "provider.connected", version: this.#version });
        this.#emitBase(threadId, runId, { type: "run.started" });
        resolve();
      });
    });
    child.once("error", (error) => {
      if (active.terminal) return;
      active.terminal = true;
      this.#emitBase(threadId, runId, { type: "run.failed", message: error.message, code: error.name });
    });
    child.stdin.end();
    return { threadId, runId };
  }

  async cancelRun(runId: string): Promise<void> {
    const active = this.#runs.get(runId);
    if (!active) return;
    active.canceled = true;
    active.child.kill("SIGINT");
  }

  async stop(): Promise<void> {
    for (const active of this.#runs.values()) {
      active.canceled = true;
      active.child.kill("SIGTERM");
    }
  }

  #handleExit(runId: string, code: number | null, signal: NodeJS.Signals | null): void {
    const active = this.#runs.get(runId);
    if (!active) return;
    this.#runs.delete(runId);
    if (!active.terminal) {
      if (active.canceled) {
        this.#emitBase(active.threadId, runId, { type: "run.completed", status: "interrupted" });
      } else if (code === 0) {
        this.#emitBase(active.threadId, runId, { type: "run.completed", status: "completed" });
      } else {
        this.#emitBase(active.threadId, runId, {
          type: "run.failed",
          message: `Antigravity CLI exited (${signal ?? code ?? "unknown"})`,
          code: code === null ? signal : String(code),
        });
      }
    }
    this.#emitBase(active.threadId, runId, {
      type: "provider.disconnected",
      reason: `Antigravity CLI exited (${signal ?? code ?? "unknown"})`,
    });
  }

  #warning(threadId: string, runId: string, message: string): void {
    this.#emitBase(threadId, runId, { type: "warning", message });
  }

  #emitBase(
    threadId: string,
    runId: string,
    event: AgentEventPayload,
  ): void {
    this.#emit({
      ...event,
      provider: "antigravity-cli",
      projectId: this.#projectId,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
      threadId,
      runId,
    } as AgentEvent);
  }

  #emit(event: AgentEvent): void {
    this.#events.emit("event", event);
  }
}
