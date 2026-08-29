export type AppErrorKind =
  | "provider"    // Agent Provider / CLI failures (Codex / Antigravity execution, not detected)
  | "project"     // Project file system, SQLite, permission issues
  | "graph"       // FlowGraph decomposition, cycle, or schema errors
  | "validation"  // User input validation (empty titles, self-loops, etc.)
  | "ipc"         // Bridge IPC communication failures
  | "network"     // Network failure, connection timeouts
  | "unknown";

export interface AppError extends Error {
  kind: AppErrorKind;
  retryable: boolean;
  code?: string;
  cause?: unknown;
}

export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof Error &&
    "kind" in err &&
    typeof (err as { kind?: unknown }).kind === "string" &&
    typeof (err as { retryable?: unknown }).retryable === "boolean"
  );
}

export function createAppError(params: {
  kind: AppErrorKind;
  message: string;
  retryable?: boolean;
  code?: string;
  cause?: unknown;
}): AppError {
  const err = new Error(params.message) as AppError;
  err.name = "AppError";
  err.kind = params.kind;
  err.retryable = params.retryable ?? false;
  err.code = params.code;
  if (params.cause) {
    err.cause = params.cause;
  }
  return err;
}
