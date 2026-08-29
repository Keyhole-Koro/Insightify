import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LAYOUT_ENGINE_VERSION, type GeneratedFlowGraph } from "@insightify/graph-domain";
import { SqliteProjectRepository } from "./project-repository.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe("SqliteProjectRepository", () => {
  it("persists project, deep-copies directory to isolated sandbox, and stores graph", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "insightify-repo-test-"));
    cleanup.push(tempDir);
    const sourceDir = path.join(tempDir, "source-app");
    const dbPath = path.join(tempDir, "db.sqlite");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(path.join(sourceDir, "package.json"), JSON.stringify({ name: "my-app" }));

    const repository = new SqliteProjectRepository(dbPath);

    const mount = repository.openPath(sourceDir);
    const [summary] = repository.list();

    expect(mount.canonicalPath).toBe(realpathSync.native(sourceDir));
    expect(mount.sandboxPath).toBeDefined();
    expect(existsSync(mount.sandboxPath)).toBe(true);
    expect(existsSync(path.join(mount.sandboxPath, "package.json"))).toBe(true);

    expect(summary.id).toBe(mount.id);
    expect(summary.displayName).toBe(path.basename(sourceDir));
    expect(summary.canonicalPath).toBe(realpathSync.native(sourceDir));
    expect(summary.sandboxPath).toBe(mount.sandboxPath);

    const storedGraph = {
      projectId: mount.id,
      provider: "codex",
      snapshotHash: "abc123",
      generatedAt: "2026-08-29T00:00:00.000Z",
      graph: {
        title: "Test flow",
        summary: "A stored graph",
        nodes: [{ id: "root", title: "Root", summary: "Root room", kind: "room", parentId: null, evidence: [] }],
        edges: [],
      },
      layout: { root: { x: 50, y: 48 } },
      layoutOverrides: { root: { x: 55, y: 52 } },
      layoutPlan: {
        version: 1,
        scopes: [{
          roomId: null,
          direction: "row",
          areas: [{ id: "system", label: "System", direction: "grid", nodeIds: ["root"] }],
        }],
      },
      layoutEngineVersion: LAYOUT_ENGINE_VERSION,
      lockedLayoutAreas: [{ roomId: null, areaId: "system" }],
    } satisfies GeneratedFlowGraph;
    repository.saveGraph(storedGraph);
    expect(repository.getGraph(mount.id)?.graph.title).toBe("Test flow");
    expect(repository.getGraph(mount.id)?.layout.root).toEqual({ x: 50, y: 48 });
    expect(repository.getGraph(mount.id)?.layoutOverrides?.root).toEqual({ x: 55, y: 52 });
    expect(repository.getGraph(mount.id)?.layoutPlan?.scopes[0]?.areas[0]?.id).toBe("system");
    expect(repository.getGraph(mount.id)?.layoutEngineVersion).toBe(LAYOUT_ENGINE_VERSION);
    expect(repository.getGraph(mount.id)?.lockedLayoutAreas).toEqual([
      { roomId: null, areaId: "system" },
    ]);

    // Coordinates written by an older layout compiler are not comparable with
    // the current one, so they are recomputed on the way out. What the user
    // dragged by hand is theirs, and survives.
    repository.saveGraph({
      ...storedGraph,
      layout: { root: { x: 90, y: 90 } },
      layoutEngineVersion: LAYOUT_ENGINE_VERSION - 1,
    });
    const refreshed = repository.getGraph(mount.id);
    expect(refreshed?.layoutEngineVersion).toBe(LAYOUT_ENGINE_VERSION);
    expect(refreshed?.layout.root).not.toEqual({ x: 90, y: 90 });
    expect(refreshed?.layoutOverrides?.root).toEqual({ x: 55, y: 52 });

    repository.close();
  });
});
