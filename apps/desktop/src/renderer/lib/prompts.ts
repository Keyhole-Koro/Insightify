import type { FlowNode, GeneratedFlowGraph } from "@insightify/graph-domain";
import type { ProjectSummary } from "@insightify/desktop-bridge";

// What the user has selected on the canvas is the context an agent run should
// inherit. Composing that here keeps the anchor format in one place instead of
// inline in a click handler.
export type PromptAnchor = {
  project: ProjectSummary;
  graph: GeneratedFlowGraph | null;
  scopePath: FlowNode[];
  node: FlowNode | null;
};

export function buildAnchoredPrompt(anchor: PromptAnchor, prompt: string): string {
  return [
    "INSIGHTIFY_FLOWFOLD_ANCHOR",
    `Project: ${anchor.project.displayName}`,
    `Graph: ${anchor.graph?.graph.title ?? "not generated"}`,
    `Room path: Root${anchor.scopePath.map((node) => ` / ${node.title}`).join("")}`,
    anchor.node ? describeAnchorNode(anchor.node) : "Selected node: root scope",
    "Treat this anchor as the working context. Propose implementation code clearly for copying.",
    "",
    prompt,
  ].join("\n");
}

function describeAnchorNode(node: FlowNode): string {
  return [
    `Selected node: ${node.title}`,
    `Node kind: ${node.kind}`,
    `Node summary: ${node.summary}`,
    `Tags: ${node.tags?.join(", ") || "none"}`,
    `Evidence: ${node.evidence.join(", ") || "none"}`,
  ].join("\n") + (node.codeSnippet ? `\nCode:\n${node.codeSnippet}` : "");
}

export function buildNodeQuestionPrompt(node: FlowNode): string {
  return `Examine node "${node.title}" (${node.kind}) and propose the code implementation or changes to be copied.`;
}

export const DEFAULT_PROMPT =
  "Review this point in the flow and propose the smallest useful implementation step.";
