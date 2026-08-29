import { homedir } from "node:os";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// Comprehensive architectural sample: "NovaFlow AI Platform"
const novaFlowGraphSource = {
  title: "NovaFlow Architecture",
  summary:
    "Full-stack AI workflow orchestration platform spanning Web, APIs, Microservices, Cloud Stores, and AI Agents.",
  nodes: [
    {
      id: "frontend-portal",
      title: "Frontend Applications",
      summary: "Modern React web console and native mobile apps connecting to the platform.",
      kind: "room",
      technology: "React",
      parentId: null,
      evidence: ["apps/web/src/App.tsx", "apps/mobile/src/index.ts"],
      tags: ["frontend", "react", "spa"],
      status: "ready",
      codeSnippet: "export function DashboardApp(): React.JSX.Element",
    },
    {
      id: "api-gateway",
      title: "POST /api/v1/workflows",
      summary: "High-throughput REST & WebSocket gateway handling ingress routing and rate limits.",
      kind: "api",
      technology: "REST",
      parentId: null,
      evidence: ["services/gateway/src/routes.ts"],
      tags: ["gateway", "rest", "routing", "ingress"],
      status: "ready",
      codeSnippet: "router.post('/v1/workflows', authGuard, rateLimiter, createWorkflowHandler);",
    },
    {
      id: "auth-guard",
      title: "Identity & JWT Guard",
      summary: "Zero-trust session verification, OAuth2 tokens, and role-based access control.",
      kind: "auth",
      technology: "OAuth",
      parentId: null,
      evidence: ["services/auth/src/guard.ts"],
      tags: ["security", "guard", "jwt", "rbac"],
      status: "ready",
      codeSnippet: "export async function verifySession(token: string): Promise<SessionUser>",
    },
    {
      id: "workflow-engine",
      title: "Workflow Engine",
      summary: "Distributed workflow scheduler and stateful execution pipeline.",
      kind: "room",
      technology: "Docker",
      parentId: null,
      evidence: ["services/engine/src/coordinator.ts"],
      tags: ["engine", "orchestration", "docker"],
      status: "ready",
      codeSnippet: "export class WorkflowCoordinator implements PipelineScheduler",
    },
    {
      id: "event-bus",
      title: "Event Bus & Task Queue",
      summary: "Low-latency Redis streams buffering asynchronous graph execution tasks.",
      kind: "queue",
      technology: "Redis",
      parentId: null,
      evidence: ["packages/queue/src/redis.ts"],
      tags: ["redis", "pubsub", "async", "streaming"],
      status: "working",
      codeSnippet: "export const taskStream = new RedisStream('events:workflow:v1');",
    },
    {
      id: "primary-db",
      title: "PostgreSQL Database",
      summary: "ACID persistent storage for workflow definitions, users, and audit logs.",
      kind: "database",
      technology: "PostgreSQL",
      parentId: null,
      evidence: ["packages/db/schema.sql"],
      tags: ["postgres", "rdbms", "acid", "persistence"],
      status: "ready",
      codeSnippet: "CREATE TABLE workflows (\n  id UUID PRIMARY KEY,\n  user_id UUID NOT NULL,\n  status VARCHAR(32) NOT NULL\n);",
    },
    {
      id: "ai-synthesizer",
      title: "OpenAI Synthesizer",
      summary: "Generative intelligence agent generating code transforms and structural summaries.",
      kind: "external",
      technology: "OpenAI",
      parentId: null,
      evidence: ["services/ai/src/openai.ts"],
      tags: ["openai", "llm", "agent", "gpt-4o"],
      status: "working",
      codeSnippet: "const res = await openai.chat.completions.create({\n  model: 'gpt-4o',\n  messages: prompt\n});",
    },
    {
      id: "cloud-storage",
      title: "AWS S3 Asset Vault",
      summary: "Encrypted blob storage for repository tarballs, sandbox diffs, and artifacts.",
      kind: "external",
      technology: "AWS",
      parentId: null,
      evidence: ["services/storage/src/s3.ts"],
      tags: ["aws", "s3", "blob", "storage"],
      status: "ready",
      codeSnippet: "await s3.send(new PutObjectCommand({ Bucket: 'novaflow-vault', Key: path }));",
    },
    {
      id: "payment-hub",
      title: "Stripe Billing Hub",
      summary: "Subscription metering, customer portal, and invoice webhook handling.",
      kind: "external",
      technology: "Stripe",
      parentId: null,
      evidence: ["services/billing/src/stripe.ts"],
      tags: ["stripe", "billing", "webhook"],
      status: "ready",
      codeSnippet: "const session = await stripe.checkout.sessions.create({ mode: 'subscription' });",
    },
    {
      id: "analytics-lake",
      title: "GCP BigQuery Lake",
      summary: "Real-time telemetry and aggregated system performance metrics stream.",
      kind: "external",
      technology: "GCP",
      parentId: null,
      evidence: ["services/telemetry/src/bigquery.ts"],
      tags: ["gcp", "bigquery", "analytics", "cloud-run"],
      status: "ready",
      codeSnippet: "await bigquery.dataset('telemetry').table('events').insert(eventBatch);",
    },

    // --- Frontend Portal Nested Nodes ---
    {
      id: "web-dashboard",
      title: "Web Dashboard UI",
      summary: "Interactive single-page application built with React and TailwindCSS.",
      kind: "ui",
      technology: "React",
      parentId: "frontend-portal",
      evidence: ["apps/web/src/pages/Dashboard.tsx"],
      tags: ["ui", "react", "dashboard"],
      status: "ready",
    },
    {
      id: "canvas-editor",
      title: "Visual Flow Canvas",
      summary: "High-performance SVG canvas rendering dynamic node topologies.",
      kind: "ui",
      technology: "React",
      parentId: "frontend-portal",
      evidence: ["apps/web/src/components/Canvas.tsx"],
      tags: ["canvas", "svg", "flowfold"],
      status: "ready",
    },
    {
      id: "mobile-client",
      title: "Mobile App View",
      summary: "Companion mobile application for notifications and status monitoring.",
      kind: "ui",
      technology: "React",
      parentId: "frontend-portal",
      evidence: ["apps/mobile/src/App.tsx"],
      tags: ["mobile", "react-native"],
      status: "ready",
    },
    {
      id: "auth-modal",
      title: "Auth Modal Screen",
      summary: "Login, SSO, and MFA verification screen overlay.",
      kind: "ui",
      technology: "React",
      parentId: "frontend-portal",
      evidence: ["apps/web/src/components/AuthModal.tsx"],
      tags: ["modal", "auth", "sso"],
      status: "ready",
    },

    // --- Workflow Engine Nested Nodes ---
    {
      id: "dispatch-service",
      title: "Step Dispatcher",
      summary: "Pulls pending workflow steps from Redis and allocates worker pods.",
      kind: "service",
      technology: "Docker",
      parentId: "workflow-engine",
      evidence: ["services/engine/src/dispatcher.ts"],
      tags: ["dispatcher", "worker"],
      status: "ready",
    },
    {
      id: "branch-evaluator",
      title: "Condition Branching",
      summary: "Evaluates conditional branches, validation rules, and error recovery policies.",
      kind: "decision",
      technology: "Docker",
      parentId: "workflow-engine",
      evidence: ["services/engine/src/evaluator.ts"],
      tags: ["decision", "branching", "rules"],
      status: "ready",
    },
    {
      id: "k8s-runner",
      title: "Kubernetes Pod Runner",
      summary: "Spawns isolated container jobs for CPU-intensive compilation and linting.",
      kind: "service",
      technology: "Kubernetes",
      parentId: "workflow-engine",
      evidence: ["services/engine/src/k8s.ts"],
      tags: ["k8s", "containers", "sandbox"],
      status: "ready",
    },
    {
      id: "state-checkpoint",
      title: "Checkpoint Logger",
      summary: "Persists step results and rollback points into PostgreSQL.",
      kind: "database",
      technology: "PostgreSQL",
      parentId: "workflow-engine",
      evidence: ["services/engine/src/checkpoint.ts"],
      tags: ["postgres", "wal"],
      status: "ready",
    },
  ],
  edges: [
    // Root level topology
    { source: "frontend-portal", target: "auth-guard", label: "bearer token" },
    { source: "auth-guard", target: "api-gateway", label: "authorized session" },
    { source: "api-gateway", target: "event-bus", label: "publish task" },
    { source: "event-bus", target: "workflow-engine", label: "dequeue step" },
    { source: "workflow-engine", target: "ai-synthesizer", label: "invoke LLM" },
    { source: "workflow-engine", target: "primary-db", label: "save state" },
    { source: "workflow-engine", target: "cloud-storage", label: "upload artifact" },
    { source: "primary-db", target: "payment-hub", label: "sync billing" },
    { source: "event-bus", target: "analytics-lake", label: "telemetry stream" },

    // Frontend Portal internal flow
    { source: "auth-modal", target: "web-dashboard", label: "authenticated" },
    { source: "web-dashboard", target: "canvas-editor", label: "open graph" },
    { source: "mobile-client", target: "web-dashboard", label: "sync state" },

    // Workflow Engine internal flow
    { source: "dispatch-service", target: "branch-evaluator", label: "eval rules" },
    { source: "branch-evaluator", target: "k8s-runner", label: "schedule container" },
    { source: "k8s-runner", target: "state-checkpoint", label: "write checkpoint" },
  ],
};

async function runSeed() {
  console.log("🌱 Seeding Insightify with rich multi-cloud & architectural sample...");

  const platformDir =
    process.platform === "darwin"
      ? path.join(homedir(), "Library", "Application Support", "insightify")
      : process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "insightify")
      : path.join(homedir(), ".config", "insightify");

  const fallbackDir = path.join(homedir(), ".insightify");
  const targetDir = existsSync(platformDir) ? platformDir : fallbackDir;
  mkdirSync(targetDir, { recursive: true });

  const dbPath = path.join(targetDir, "insightify.sqlite3");
  console.log(`📁 Database path: ${dbPath}`);

  // Dynamic import DatabaseSync from node:sqlite
  const { DatabaseSync } = await import("node:sqlite");
  const { cpSync, realpathSync } = await import("node:fs");
  const { randomUUID } = await import("node:crypto");

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  db.exec(`
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
      layout_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  const samplePath = realpathSync.native(process.cwd());
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM projects WHERE canonical_path = ?").get(samplePath);
  const projectId = existing?.id ?? randomUUID();
  const displayName = "NovaFlow Platform";

  db.prepare(`
    INSERT INTO projects (id, display_name, canonical_path, last_opened_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(canonical_path) DO UPDATE SET
      display_name = excluded.display_name,
      last_opened_at = excluded.last_opened_at
  `).run(projectId, displayName, samplePath, now);

  const sandboxBaseDir = path.join(targetDir, "sandboxes", projectId);
  mkdirSync(sandboxBaseDir, { recursive: true });

  // Compute Layout
  const nodes = novaFlowGraphSource.nodes;
  const layout = {};
  const visible = nodes.filter((n) => n.parentId === null);
  const total = visible.length;
  visible.forEach((node, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    layout[node.id] = {
      x: 18 + col * 22,
      y: 24 + row * 38,
    };
  });

  db.prepare(`
    INSERT INTO project_graphs (project_id, provider, snapshot_hash, generated_at, graph_json, layout_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      provider = excluded.provider,
      snapshot_hash = excluded.snapshot_hash,
      generated_at = excluded.generated_at,
      graph_json = excluded.graph_json,
      layout_json = excluded.layout_json
  `).run(
    projectId,
    "codex",
    "seed-hash-novaflow-v1",
    now,
    JSON.stringify(novaFlowGraphSource),
    JSON.stringify(layout)
  );

  console.log(`✅ Project seeded: "${displayName}" (ID: ${projectId})`);
  console.log(`🛡️ Sandbox copy location: ${sandboxBaseDir}`);
  console.log(`🚀 Seeded ${nodes.length} nodes across AWS, GCP, Docker, Kubernetes, Postgres, Redis, OpenAI, Stripe, and React.`);

  db.close();
  console.log("✨ Seeding complete! Run `bun dev` or `bun preview` to view the live diagram.");
}

runSeed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
