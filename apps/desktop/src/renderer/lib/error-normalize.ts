import { ZodError } from "zod";
import { type AppError, createAppError, isAppError } from "./errors.js";

/**
 * Normalizes any error into a typed AppError with consistent user-facing message and retryability.
 */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) {
    return err;
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue?.path.join(".") || "input";
    const message = issue ? `Validation error at ${path}: ${issue.message}` : "Schema validation failed";
    return createAppError({
      kind: "validation",
      message,
      retryable: false,
      code: "SCHEMA_VALIDATION_ERROR",
      cause: err,
    });
  }

  // Handle generic string errors or Error instances
  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : String(err);

  // Classify by error message patterns
  if (/cli not detected|not found|enoent/i.test(rawMessage)) {
    return createAppError({
      kind: "provider",
      message: rawMessage,
      retryable: true,
      code: "PROVIDER_NOT_AVAILABLE",
      cause: err,
    });
  }

  if (/network|fetch|timeout|econnrefused/i.test(rawMessage)) {
    return createAppError({
      kind: "network",
      message: "通信エラーが発生しました。接続を確認してください。",
      retryable: true,
      code: "NETWORK_ERROR",
      cause: err,
    });
  }

  if (/sqlite|database|permission|eacces|eperm/i.test(rawMessage)) {
    return createAppError({
      kind: "project",
      message: `プロジェクトデータへのアクセスに失敗しました: ${rawMessage}`,
      retryable: false,
      code: "PROJECT_ACCESS_ERROR",
      cause: err,
    });
  }

  if (/ipc|channel|electron|could not be cloned|dataclone/i.test(rawMessage)) {
    return createAppError({
      kind: "ipc",
      message: `内部通信エラーが発生しました: ${rawMessage}`,
      retryable: true,
      code: "IPC_ERROR",
      cause: err,
    });
  }

  return createAppError({
    kind: "unknown",
    message: rawMessage || "予期しないエラーが発生しました。",
    retryable: false,
    cause: err,
  });
}
