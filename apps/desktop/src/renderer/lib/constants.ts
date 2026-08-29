import type { ExecutableAgentProvider } from "@insightify/desktop-bridge";
import type { FlowNodeKind } from "@insightify/graph-domain";

export const providerKinds: ExecutableAgentProvider[] = ["antigravity-cli", "codex"];

export const providerMeta: Record<
  ExecutableAgentProvider,
  { label: string; shortLabel: string; policy: string }
> = {
  codex: {
    label: "Codex",
    shortLabel: "CX",
    policy: "workspace-write · interactive approvals",
  },
  "antigravity-cli": {
    label: "Antigravity",
    shortLabel: "AG",
    policy: "sandbox · configured permissions",
  },
};

export const nodeKinds: FlowNodeKind[] = ["room", "process", "decision", "data", "external"];
