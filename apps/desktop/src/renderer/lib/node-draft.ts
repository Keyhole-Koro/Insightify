import type { FlowNode, FlowNodeKind, FlowNodeStatus } from "@insightify/graph-domain";
import { parseEvidence } from "./flowfold-helpers.js";

// The editor works on strings because a textarea does. The graph works on the
// domain shape. This module owns the translation in both directions, so neither
// the form component nor the canvas has to know about the other's format.
export interface NodeDraft {
  nodeId: string;
  title: string;
  summary: string;
  kind: FlowNodeKind;
  technology: string;
  evidence: string;
  tags: string;
  status: FlowNodeStatus;
  codeSnippet: string;
}

export const MAX_NODE_TAGS = 6;

export function nodeDraftFromNode(node: FlowNode): NodeDraft {
  return {
    nodeId: node.id,
    title: node.title,
    summary: node.summary,
    kind: node.kind,
    technology: node.technology ?? "",
    evidence: node.evidence.join("\n"),
    tags: node.tags?.join(", ") ?? "",
    status: node.status ?? "idle",
    codeSnippet: node.codeSnippet ?? "",
  };
}

export function isNodeDraftComplete(draft: NodeDraft): boolean {
  return draft.title.trim().length > 0 && draft.summary.trim().length > 0;
}

export function parseNodeTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, MAX_NODE_TAGS);
}

// Optional fields are dropped rather than stored as "", so an emptied field
// leaves the node in the same shape the generator would have produced.
export function nodePatchFromDraft(draft: NodeDraft): Partial<FlowNode> {
  const tags = parseNodeTags(draft.tags);
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    kind: draft.kind,
    technology: draft.technology.trim() || undefined,
    evidence: parseEvidence(draft.evidence),
    tags: tags.length > 0 ? tags : undefined,
    status: draft.status,
    codeSnippet: draft.codeSnippet.trim() || undefined,
  };
}
