import { existsSync, realpathSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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

  // The migration list replaced a bootstrap that maintained the schema with
  // CREATE TABLE IF NOT EXISTS and PRAGMA-driven ALTER, and wrote versions 1-4
  // unconditionally. A database left behind by that build must be recognised as
  // already migrated rather than migrated again.
  it("leaves a database written by the previous bootstrap untouched", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "insightify-repo-legacy-"));
    cleanup.push(tempDir);
    const dbPath = path.join(tempDir, "legacy.sqlite");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL,
        canonical_path TEXT NOT NULL UNIQUE, last_opened_at TEXT NOT NULL
      );
      CREATE TABLE project_graphs (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL, snapshot_hash TEXT NOT NULL, generated_at TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        layout_json TEXT NOT NULL DEFAULT '{}',
        layout_overrides_json TEXT NOT NULL DEFAULT '{}',
        layout_plan_json TEXT, layout_engine_version INTEGER, locked_layout_areas_json TEXT
      );
      INSERT INTO projects VALUES ('legacy-id', 'Legacy', '/tmp/legacy-project', '2026-01-01T00:00:00.000Z');
      INSERT INTO schema_migrations VALUES (1, 'x'), (2, 'x'), (3, 'x'), (4, 'x');
    `);
    legacy.close();

    const repository = new SqliteProjectRepository(dbPath);
    expect(repository.list().map((project) => project.id)).toEqual(["legacy-id"]);

    const inspect = new DatabaseSync(dbPath);
    const rows = inspect.prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version").all();
    inspect.close();
    // Still four rows, and none of them re-stamped with a new timestamp.
    expect(rows).toEqual([
      { version: 1, applied_at: "x" },
      { version: 2, applied_at: "x" },
      { version: 3, applied_at: "x" },
      { version: 4, applied_at: "x" },
    ]);
  });

  it("brings a fresh database up to the newest migration", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "insightify-repo-fresh-"));
    cleanup.push(tempDir);
    const dbPath = path.join(tempDir, "fresh.sqlite");
    new SqliteProjectRepository(dbPath);

    const inspect = new DatabaseSync(dbPath);
    const { version } = inspect
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number };
    const columns = (inspect.prepare("PRAGMA table_info(project_graphs)").all() as Array<{ name: string }>)
      .map((column) => column.name);
    inspect.close();

    expect(version).toBe(4);
    expect(columns).toContain("locked_layout_areas_json");
    expect(columns).toContain("layout_overrides_json");
  });
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
