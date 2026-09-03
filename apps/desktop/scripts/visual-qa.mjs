import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 5199;
      server.close(() => resolve(port));
    });
  });
}

async function waitForUrl(url, child) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Preview server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stop(child) {
  if (child && child.exitCode === null) child.kill("SIGTERM");
}


/**
 * Absolute numbers say what the canvas looks like today; only a baseline says
 * whether it got worse. The comparison is over warnings rather than raw
 * geometry, because geometry moves for good reasons — a fixture gaining a node
 * is not a regression, a Room whose children left their frame is.
 */
// A warning carries the measurement that produced it, which is what makes it
// useful to read and useless to compare: every harmless nudge would look like a
// new warning. The identity of a warning is what it is about, not how large it
// was, so the numbers come out before the sets are compared.
function warningKey(warning) {
  return warning.replace(/-?\d+(\.\d+)?/g, "#");
}

async function compareWithBaseline(runDir, scenarioDocument) {
  const baselinePath = path.join(desktopRoot, "visual-qa", "baselines", `${scenarioDocument.id}.json`);
  const report = JSON.parse(await readFile(path.join(runDir, "report.json"), "utf8"));
  const current = Object.fromEntries(
    report.checkpoints.map((checkpoint) => [checkpoint.name, checkpoint.metrics.warnings])
  );

  if (process.argv.includes("--update-baseline")) {
    await mkdir(path.dirname(baselinePath), { recursive: true });
    await writeFile(baselinePath, `${JSON.stringify({ id: scenarioDocument.id, checkpoints: current }, null, 2)}\n`);
    console.log(`Baseline updated: ${baselinePath}`);
    return false;
  }

  let baseline;
  try {
    baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  } catch {
    console.log(`No baseline yet. Record one with: bun run visual:qa -- --update-baseline`);
    return false;
  }

  let regressed = false;
  for (const [name, warnings] of Object.entries(current)) {
    const before = new Set((baseline.checkpoints?.[name] ?? []).map(warningKey));
    const now = new Set(warnings.map(warningKey));
    const appeared = warnings.filter((warning) => !before.has(warningKey(warning)));
    const resolved = (baseline.checkpoints?.[name] ?? []).filter(
      (warning) => !now.has(warningKey(warning))
    );
    for (const warning of resolved) console.log(`  fixed  ${name}: ${warning}`);
    for (const warning of appeared) console.error(`  NEW    ${name}: ${warning}`);
    if (appeared.length > 0) regressed = true;
  }
  if (regressed) {
    console.error("Visual QA found warnings that are not in the baseline.");
    console.error("Accept them deliberately with: bun run visual:qa -- --update-baseline");
  }
  return regressed;
}

const scenarioName = option("scenario", "room-expansion");
const scenarioPath = scenarioName.endsWith(".json")
  ? path.resolve(process.cwd(), scenarioName)
  : path.join(desktopRoot, "visual-qa", "scenarios", `${scenarioName}.json`);
const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const outDir = path.resolve(option("out", `/tmp/insightify-visual-qa/${scenario.id}-${stamp}`));
await mkdir(outDir, { recursive: true });

const port = await freePort();
const url = `http://127.0.0.1:${port}/`;
const vite = spawn(
  path.join(desktopRoot, "node_modules", ".bin", "vite"),
  ["--config", "vite.preview.config.mts", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: desktopRoot, stdio: ["ignore", "pipe", "pipe"] }
);
let viteLog = "";
vite.stdout.on("data", (chunk) => { viteLog += chunk; });
vite.stderr.on("data", (chunk) => { viteLog += chunk; });

let electron;
const cleanup = () => {
  stop(electron);
  stop(vite);
};
process.once("SIGINT", () => { cleanup(); process.exit(130); });
process.once("SIGTERM", () => { cleanup(); process.exit(143); });

try {
  await waitForUrl(url, vite);
  const electronBinary = require("electron");
  electron = spawn(
    electronBinary,
    ["--no-sandbox", path.join(scriptDir, "visual-qa-electron.cjs")],
    {
      cwd: desktopRoot,
      env: {
        ...process.env,
        INSIGHTIFY_VQA_URL: url,
        INSIGHTIFY_VQA_SCENARIO: scenarioPath,
        INSIGHTIFY_VQA_OUT: outDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  electron.stdout.pipe(process.stdout);
  electron.stderr.pipe(process.stderr);
  const exitCode = await new Promise((resolve) => electron.once("exit", resolve));
  if (exitCode !== 0) throw new Error(`Visual QA Electron runner exited with ${exitCode}`);
  console.log(`Visual QA artifacts: ${outDir}`);
  const regressed = await compareWithBaseline(outDir, scenario);
  if (regressed) process.exitCode = 1;
} catch (error) {
  console.error(viteLog.trim());
  throw error;
} finally {
  cleanup();
}
