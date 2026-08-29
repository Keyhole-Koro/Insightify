import { describe, expect, it } from "vitest";
import { AGENT_PROVIDER_KINDS } from "@insightify/agent-runtime";
import { executableAgentProviderSchema, executableAgentProviders } from "./index.js";

describe("executable providers", () => {
  it("is derived from the runtime's provider list, not a second copy of it", () => {
    for (const provider of executableAgentProviders) {
      expect(AGENT_PROVIDER_KINDS).toContain(provider);
    }
  });

  it("covers every runtime provider except the ones that cannot be launched", () => {
    const excluded = AGENT_PROVIDER_KINDS.filter(
      (kind) => !(executableAgentProviders as readonly string[]).includes(kind)
    );
    expect(excluded).toEqual(["antigravity-sdk"]);
  });

  it("accepts the launchable providers and rejects anything else", () => {
    for (const provider of executableAgentProviders) {
      expect(executableAgentProviderSchema.safeParse(provider).success).toBe(true);
    }
    expect(executableAgentProviderSchema.safeParse("antigravity-sdk").success).toBe(false);
    expect(executableAgentProviderSchema.safeParse("gemini").success).toBe(false);
  });
});
