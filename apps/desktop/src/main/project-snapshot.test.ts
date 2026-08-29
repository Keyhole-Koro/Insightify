import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildFlowGraphExpansionPrompt, buildLayoutPlanPrompt, buildFlowGraphPrompt, buildProjectSnapshot } from "./project-snapshot.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe("buildProjectSnapshot", () => {
  it("captures useful text while excluding secrets and dependencies", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "insightify-snapshot-"));
    cleanup.push(root);
    await mkdir(path.join(root, "src"));
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "README.md"), "# Example\nArchitecture overview");
    await writeFile(path.join(root, "src", "main.ts"), "export const main = true;");
    await writeFile(path.join(root, ".env"), "TOKEN=secret");
    await writeFile(path.join(root, "node_modules", "ignored.js"), "ignored");

    const snapshot = await buildProjectSnapshot(root);

    expect(snapshot.files).toContain("README.md");
    expect(snapshot.files).toContain("src/main.ts");
    expect(snapshot.files).not.toContain(".env");
    expect(snapshot.files).not.toContain("node_modules/ignored.js");
    expect(buildFlowGraphPrompt(snapshot)).toContain("untrusted data");
    expect(buildFlowGraphPrompt(snapshot)).toContain("Never generate coordinates");
    expect(buildFlowGraphExpansionPrompt(snapshot, {
      title: "Graph",
      summary: "Graph summary",
      nodes: [{ id: "root", title: "Root", summary: "Root summary", kind: "room", parentId: null, evidence: [] }],
      edges: [],
    }, "root")).toContain("Add 4-7 useful direct child nodes");
    expect(buildFlowGraphExpansionPrompt(snapshot, {
      title: "Graph",
      summary: "Graph summary",
      nodes: [{ id: "root", title: "Root", summary: "Root summary", kind: "room", parentId: null, evidence: [] }],
      edges: [],
    }, "root")).toContain("layoutScopes");
  });

  it("shows a layout run the nodes to arrange and nothing more", () => {
    const prompt = buildLayoutPlanPrompt({
      title: "Graph",
      summary: "Graph summary",
      nodes: [
        {
          id: "root",
          title: "Root",
          summary: "Root summary",
          kind: "room",
          parentId: null,
          evidence: ["src/secret-path.ts"],
          codeSnippet: "const apiKey = process.env.KEY",
        },
        { id: "leaf", title: "Leaf", summary: "Leaf summary", kind: "api", parentId: "root", evidence: [] },
      ],
      edges: [{ source: "root", target: "leaf", label: "calls" }],
    });

    // What it needs to group nodes.
    expect(prompt).toContain("\"id\":\"root\"");
    expect(prompt).toContain("\"parentId\":\"root\"");
    expect(prompt).toContain("calls");
    // A layout run reads no project files, so none of that reaches the model.
    expect(prompt).not.toContain("src/secret-path.ts");
    expect(prompt).not.toContain("apiKey");
    expect(prompt).not.toContain("Root summary");
    expect(prompt).not.toContain("PROJECT_SNAPSHOT_JSON");
    // And it must not be able to change the graph.
    expect(prompt).toContain("never change the graph");
  });
});
