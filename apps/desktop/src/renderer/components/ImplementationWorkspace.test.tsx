import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FlowNode } from "@insightify/graph-domain";
import { ImplementationWorkspace } from "./ImplementationWorkspace.js";

const node: FlowNode = {
  id: "worker",
  parentId: null,
  title: "Task Worker",
  summary: "Consumes and executes queued work.",
  kind: "service",
  evidence: ["src/worker.ts"],
  implementation: {
    entrypoint: "consumeTask",
    source: { path: "src/worker.ts", symbol: "consumeTask" },
    steps: [
      {
        id: "decode",
        title: "Decode task",
        summary: "Turns the envelope into a command.",
        kind: "phase",
      },
    ],
  },
};

describe("ImplementationWorkspace", () => {
  const placement = {
    anchorX: 500,
    anchorY: 300,
    height: 350,
    left: 48,
    side: "left" as const,
    top: 120,
    width: 440,
  };

  it("renders the implementation beside its canvas node", () => {
    const html = renderToStaticMarkup(
      <ImplementationWorkspace
        node={node}
        placement={placement}
        onAskAi={() => {}}
        onClose={() => {}}
        onPeek={() => {}}
      />
    );
    expect(html).toContain('data-vqa="implementation-workspace"');
    expect(html).toContain('role="region"');
    expect(html).toContain("attached to node");
    expect(html).toContain("implementation-inline-connector");
    expect(html).toContain('class="implementation-tree workspace"');
  });

  it("does not render when no implementation outline exists", () => {
    const html = renderToStaticMarkup(
      <ImplementationWorkspace
        node={{ ...node, implementation: undefined }}
        placement={placement}
        onAskAi={() => {}}
        onClose={() => {}}
        onPeek={() => {}}
      />
    );
    expect(html).toBe("");
  });
});
