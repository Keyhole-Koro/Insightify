export type JsonRpcId = number | string;

export type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

export type JsonRpcServerRequest = JsonRpcNotification & {
  id: JsonRpcId;
};

export type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification | JsonRpcServerRequest;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (!isRecord(value)) return false;
  return "id" in value || typeof value.method === "string";
}

export function parseJsonLine(line: string): JsonRpcMessage {
  const value: unknown = JSON.parse(line);
  if (!isJsonRpcMessage(value)) {
    throw new Error("Codex app-server emitted a non protocol JSON value");
  }
  return value;
}
