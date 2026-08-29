import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProjectSummary } from "@insightify/desktop-bridge";
import { z } from "zod";
import {
  graphLayoutSchema,
  layoutAreaLockSchema,
  parseFlowGraph,
  semanticLayoutPlanSchema,
  withCurrentLayoutEngine,
  type GeneratedFlowGraph,
} from "@insightify/graph-domain";

type ProjectRow = {
  id: string;
  display_name: string;
  canonical_path: string;
  last_opened_at: string;
};

type ProjectGraphRow = {
  project_id: string;
  provider: string;
  snapshot_hash: string;
  generated_at: string;
  graph_json: string;
  layout_json: string;
  layout_overrides_json: string;
  layout_plan_json: string | null;
  layout_engine_version: number | null;
  locked_layout_areas_json: string | null;
};

export type ProjectMount = ProjectSummary & {
  canonicalPath: string;
  sandboxPath: string;
};

export interface ProjectRepository {
  openPath(selectedPath: string): ProjectMount;
  list(): ProjectSummary[];
  resolve(projectId: string): ProjectMount | null;
  getGraph(projectId: string): GeneratedFlowGraph | null;
  saveGraph(value: GeneratedFlowGraph): void;
  syncSandboxCopy(projectId: string): string;
  close(): void;
}

const IGNORE_COPY_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.vite/,
  /\.turbo/,
  /dist/,
  /out/,
  /\.DS_Store/,
  /\.insightify/,
];

export class SqliteProjectRepository implements ProjectRepository {
  readonly #database: DatabaseSync;
  readonly #sandboxBaseDir: string;

  constructor(databasePath: string) {
    this.#database = new DatabaseSync(databasePath);
    this.#sandboxBaseDir = path.join(path.dirname(databasePath), "sandboxes");
    mkdirSync(this.#sandboxBaseDir, { recursive: true });
    this.#database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.#migrate();
  }

  openPath(selectedPath: string): ProjectMount {
    const canonicalPath = realpathSync.native(selectedPath);
    const now = new Date().toISOString();
    const current = this.#database
      .prepare("SELECT id FROM projects WHERE canonical_path = ?")
      .get(canonicalPath) as { id: string } | undefined;
    const id = current?.id ?? randomUUID();
    const displayName = path.basename(canonicalPath) || canonicalPath;

    this.#database
      .prepare(`
        INSERT INTO projects (id, display_name, canonical_path, last_opened_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(canonical_path) DO UPDATE SET
          display_name = excluded.display_name,
          last_opened_at = excluded.last_opened_at
      `)
      .run(id, displayName, canonicalPath, now);

    const sandboxPath = this.syncSandboxCopy(id, canonicalPath);

    return {
      id,
      displayName,
      canonicalPath,
      sandboxPath,
      lastOpenedAt: now,
    };
  }

  list(): ProjectSummary[] {
    const rows = this.#database
      .prepare(`
        SELECT id, display_name, canonical_path, last_opened_at
        FROM projects
        ORDER BY last_opened_at DESC
      `)
      .all() as ProjectRow[];
    return rows.map((row) => this.#toSummary(row));
  }

  resolve(projectId: string): ProjectMount | null {
    const row = this.#database
      .prepare(`
        SELECT id, display_name, canonical_path, last_opened_at
        FROM projects
        WHERE id = ?
      `)
      .get(projectId) as ProjectRow | undefined;
    if (!row) return null;
    const summary = this.#toSummary(row);
    return {
      ...summary,
      canonicalPath: row.canonical_path,
      sandboxPath: summary.sandboxPath!,
    };
  }

  /**
   * Deep copies the original project directory to an isolated sandbox workspace.
   * This guarantees that the experimental phase never modifies the original source tree.
   */
  syncSandboxCopy(projectId: string, explicitCanonicalPath?: string): string {
    const canonicalPath =
      explicitCanonicalPath ??
      (
        this.#database
          .prepare("SELECT canonical_path FROM projects WHERE id = ?")
          .get(projectId) as { canonical_path: string } | undefined
      )?.canonical_path;

    if (!canonicalPath || !existsSync(canonicalPath)) {
      throw new Error(`Cannot locate canonical project path for project ${projectId}`);
    }

    const sandboxPath = path.join(this.#sandboxBaseDir, projectId);
    mkdirSync(sandboxPath, { recursive: true });

    // Perform deep directory copy with safe excludes
    cpSync(canonicalPath, sandboxPath, {
      recursive: true,
      filter: (source) => {
        const basename = path.basename(source);
        return !IGNORE_COPY_PATTERNS.some((pattern) => pattern.test(basename));
      },
    });

    return sandboxPath;
  }

  getGraph(projectId: string): GeneratedFlowGraph | null {
    const row = this.#database
      .prepare(`
        SELECT project_id, provider, snapshot_hash, generated_at, graph_json, layout_json,
               layout_overrides_json, layout_plan_json, layout_engine_version,
               locked_layout_areas_json
        FROM project_graphs
        WHERE project_id = ?
      `)
      .get(projectId) as ProjectGraphRow | undefined;
    if (!row) return null;
    const layoutPlan = row.layout_plan_json
      ? semanticLayoutPlanSchema.parse(JSON.parse(row.layout_plan_json))
      : undefined;
    // A document laid out by an older compiler is refreshed on the way out, so
    // the canvas never mixes coordinates from two engines.
    return withCurrentLayoutEngine({
      projectId: row.project_id,
      provider: row.provider,
      snapshotHash: row.snapshot_hash,
      generatedAt: row.generated_at,
      graph: parseFlowGraph(JSON.parse(row.graph_json)),
      layout: graphLayoutSchema.parse(JSON.parse(row.layout_json)),
      ...(Object.keys(JSON.parse(row.layout_overrides_json) as object).length > 0
        ? { layoutOverrides: graphLayoutSchema.parse(JSON.parse(row.layout_overrides_json)) }
        : {}),
      ...(layoutPlan ? { layoutPlan } : {}),
      ...(row.layout_engine_version !== null
        ? { layoutEngineVersion: row.layout_engine_version }
        : {}),
      ...(row.locked_layout_areas_json
        ? {
            lockedLayoutAreas: z
              .array(layoutAreaLockSchema)
              .parse(JSON.parse(row.locked_layout_areas_json)),
          }
        : {}),
    });
  }

  saveGraph(value: GeneratedFlowGraph): void {
    this.#database
      .prepare(`
        INSERT INTO project_graphs (
          project_id, provider, snapshot_hash, generated_at, graph_json, layout_json,
          layout_overrides_json, layout_plan_json, layout_engine_version,
          locked_layout_areas_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          provider = excluded.provider,
          snapshot_hash = excluded.snapshot_hash,
          generated_at = excluded.generated_at,
          graph_json = excluded.graph_json,
          layout_json = excluded.layout_json,
          layout_overrides_json = excluded.layout_overrides_json,
          layout_plan_json = excluded.layout_plan_json,
          layout_engine_version = excluded.layout_engine_version,
          locked_layout_areas_json = excluded.locked_layout_areas_json
      `)
      .run(
        value.projectId,
        value.provider,
        value.snapshotHash,
        value.generatedAt,
        JSON.stringify(value.graph),
        JSON.stringify(value.layout),
        JSON.stringify(value.layoutOverrides ?? {}),
        value.layoutPlan ? JSON.stringify(value.layoutPlan) : null,
        value.layoutEngineVersion ?? null,
        value.lockedLayoutAreas?.length ? JSON.stringify(value.lockedLayoutAreas) : null
      );
  }

  close(): void {
    this.#database.close();
  }

  #toSummary(row: ProjectRow): ProjectSummary {
    const sandboxPath = path.join(this.#sandboxBaseDir, row.id);
    return {
      id: row.id,
      displayName: row.display_name,
      canonicalPath: row.canonical_path,
      sandboxPath: existsSync(sandboxPath) ? sandboxPath : undefined,
      lastOpenedAt: row.last_opened_at,
    };
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        canonical_path TEXT NOT NULL UNIQUE,
        last_opened_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_graphs (
        project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        layout_json TEXT NOT NULL DEFAULT '{}',
        layout_overrides_json TEXT NOT NULL DEFAULT '{}',
        layout_plan_json TEXT,
        layout_engine_version INTEGER,
        locked_layout_areas_json TEXT
      );

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, CURRENT_TIMESTAMP);

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (2, CURRENT_TIMESTAMP);
    `);
    const graphColumns = this.#database
      .prepare("PRAGMA table_info(project_graphs)")
      .all() as Array<{ name: string }>;
    if (!graphColumns.some((column) => column.name === "layout_json")) {
      this.#database.exec(
        "ALTER TABLE project_graphs ADD COLUMN layout_json TEXT NOT NULL DEFAULT '{}'"
      );
    }
    const additionalGraphColumns = [
      ["layout_overrides_json", "TEXT NOT NULL DEFAULT '{}'"],
      ["layout_plan_json", "TEXT"],
      ["layout_engine_version", "INTEGER"],
      ["locked_layout_areas_json", "TEXT"],
    ] as const;
    for (const [name, definition] of additionalGraphColumns) {
      if (!graphColumns.some((column) => column.name === name)) {
        this.#database.exec(`ALTER TABLE project_graphs ADD COLUMN ${name} ${definition}`);
      }
    }
    this.#database.exec(`
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (3, CURRENT_TIMESTAMP);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (4, CURRENT_TIMESTAMP);
    `);
  }
}
