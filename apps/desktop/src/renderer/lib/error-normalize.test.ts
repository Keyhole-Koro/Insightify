import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAppError } from "./errors.js";
import { toAppError } from "./error-normalize.js";

describe("toAppError", () => {
  it("passes through existing AppError", () => {
    const existing = createAppError({ kind: "graph", message: "Graph error", retryable: true });
    expect(toAppError(existing)).toBe(existing);
  });

  it("normalizes ZodError to validation error", () => {
    const schema = z.object({ title: z.string().min(1) });
    const result = schema.safeParse({ title: "" });
    if (!result.success) {
      const err = toAppError(result.error);
      expect(err.kind).toBe("validation");
      expect(err.code).toBe("SCHEMA_VALIDATION_ERROR");
      expect(err.retryable).toBe(false);
      expect(err.message).toContain("title");
    }
  });

  it("normalizes provider error message", () => {
    const err = toAppError(new Error("codex CLI not detected on system path"));
    expect(err.kind).toBe("provider");
    expect(err.code).toBe("PROVIDER_NOT_AVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("normalizes network error message", () => {
    const err = toAppError(new Error("fetch timeout while connecting"));
    expect(err.kind).toBe("network");
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.retryable).toBe(true);
  });

  it("handles string error fallback", () => {
    const err = toAppError("Something broke unexpectedly");
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("Something broke unexpectedly");
    expect(err.retryable).toBe(false);
  });
});
