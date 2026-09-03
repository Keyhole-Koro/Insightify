const { app, BrowserWindow } = require("electron");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const url = process.env.INSIGHTIFY_VQA_URL;
const scenarioPath = process.env.INSIGHTIFY_VQA_SCENARIO;
const outDir = process.env.INSIGHTIFY_VQA_OUT;
const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.disableHardwareAcceleration();

function actionScript(action) {
  if (!action) return null;
  const selector = JSON.stringify(action.selector ?? "");
  const index = Number(action.index ?? 0);
  if (action.type === "click") {
    return `(() => {
      const nodes = [...document.querySelectorAll(${selector})].filter((candidate) => {
        const style = getComputedStyle(candidate);
        const box = candidate.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) > 0.02 && box.width > 0 && box.height > 0;
      });
      const node = nodes[${index}];
      if (!node) throw new Error('Visual QA click target not found: ' + ${selector} + ' [${index}]');
      node.click();
      return { clicked: node.getAttribute('data-vqa-node-id') || node.textContent?.trim() || ${selector} };
    })()`;
  }
  if (action.type === "clickText") {
    const text = JSON.stringify(action.text ?? "");
    return `(() => {
      const node = [...document.querySelectorAll(${selector})].find((candidate) => {
        const style = getComputedStyle(candidate);
        const box = candidate.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) > 0.02 && box.width > 0 && box.height > 0
          && (candidate.textContent || '').includes(${text});
      });
      if (!node) throw new Error('Visual QA text target not found: ' + ${text});
      node.click();
      return { clicked: node.getAttribute('data-vqa-node-id') || node.textContent?.trim() || ${text} };
    })()`;
  }
  if (action.type === "wheel") {
    const deltaY = Number(action.deltaY ?? 0);
    return `(() => {
      const node = document.querySelector(${selector});
      if (!node) throw new Error('Visual QA wheel target not found: ' + ${selector});
      node.dispatchEvent(new WheelEvent('wheel', { deltaY: ${deltaY}, bubbles: true, cancelable: true }));
      return { deltaY: ${deltaY} };
    })()`;
  }
  if (action.type === "evaluate") return action.expression;
  throw new Error(`Unknown Visual QA action: ${action.type}`);
}

async function waitForSelector(webContents, selector, timeout = 8_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      true
    );
    if (found) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for selector: ${selector}`);
}

// This function is serialized and evaluated in the renderer. Keep it free of
// references to the Electron/Node closure above.
function collectPageReport(measurements, thresholds) {
  const round = (value) => Math.round(value * 10) / 10;
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    return {
      x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height),
      right: round(box.right), bottom: round(box.bottom),
    };
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02
      && box.width > 0 && box.height > 0;
  };
  const union = (boxes) => boxes.length === 0 ? null : {
    x: round(Math.min(...boxes.map((box) => box.x))),
    y: round(Math.min(...boxes.map((box) => box.y))),
    right: round(Math.max(...boxes.map((box) => box.right))),
    bottom: round(Math.max(...boxes.map((box) => box.bottom))),
    width: round(Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.x))),
    height: round(Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.y))),
  };
  const overlapArea = (left, right) =>
    Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x))
    * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y));
  const median = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
  };
  const axisGroups = (items, axis, medianSize) => {
    const size = axis === "x" ? "width" : "height";
    const end = axis === "x" ? "right" : "bottom";
    const ordered = [...items].sort((left, right) =>
      left.box[axis] + left.box[size] / 2 - (right.box[axis] + right.box[size] / 2)
    );
    const groups = [];
    for (const item of ordered) {
      const center = item.box[axis] + item.box[size] / 2;
      const group = groups.at(-1);
      if (!group || Math.abs(center - group.center) > Math.max(4, medianSize * 0.6)) {
        groups.push({ center, items: [item] });
      } else {
        group.items.push(item);
        group.center = group.items.reduce((sum, member) => sum + member.box[axis] + member.box[size] / 2, 0)
          / group.items.length;
      }
    }
    const bounds = groups.map((group) => union(group.items.map((item) => item.box)));
    return {
      count: groups.length,
      gaps: bounds.slice(1).map((box, index) => round(box[axis] - bounds[index][end])),
    };
  };

  const stageElement = document.querySelector('[data-vqa="graph-stage"]');
  const canvasElement = document.querySelector(".canvas-frame");
  const stage = stageElement ? rect(stageElement) : null;
  const canvas = canvasElement ? rect(canvasElement) : null;
  const nodeElements = [...document.querySelectorAll('[data-vqa="flow-node"]')].filter(visible);
  const nodes = nodeElements.map((element) => {
    const regions = [...element.querySelectorAll(":scope > .node-avatar-container .node-avatar, :scope > .node-compact-pill, :scope > .node-detail-plate")]
      .filter(visible)
      .map(rect);
    const declared = (element.dataset.vqaExtent || "").split("x").map(Number);
    return {
      id: element.dataset.vqaNodeId,
      parentId: element.dataset.vqaParentId,
      nested: element.dataset.vqaNested === "true",
      expanded: element.dataset.vqaExpanded === "true",
      box: union(regions) ?? rect(element),
      regions: regions.length > 0 ? regions : [rect(element)],
      declaredExtent: declared.length === 2 && declared.every(Number.isFinite)
        ? { width: declared[0], height: declared[1] }
        : null,
    };
  });
  const frames = [...document.querySelectorAll('[data-vqa="room-frame"]')].filter(visible).map((element) => {
    const box = rect(element);
    const roomId = element.dataset.vqaRoomId;
    const ownedChildren = nodes.filter((node) => node.nested && node.parentId === roomId);
    const children = ownedChildren.filter((node) =>
      node.box.x + node.box.width / 2 >= box.x
      && node.box.x + node.box.width / 2 <= box.right
      && node.box.y + node.box.height / 2 >= box.y
      && node.box.y + node.box.height / 2 <= box.bottom);
    const childBounds = union(children.map((child) => child.box));
    const medianChildWidth = median(children.map((child) => child.box.width));
    const medianChildHeight = median(children.map((child) => child.box.height));
    const rowLayout = axisGroups(children, "y", medianChildHeight ?? 0);
    const columnLayout = axisGroups(children, "x", medianChildWidth ?? 0);
    const medianRowGap = median(rowLayout.gaps);
    const medianColumnGap = median(columnLayout.gaps);
    return {
      roomId,
      columns: Number(element.dataset.vqaColumns),
      rows: Number(element.dataset.vqaRows),
      childCount: Number(element.dataset.vqaChildCount),
      box,
      childBounds,
      measuredChildren: children,
      spacing: {
        rowCount: rowLayout.count,
        columnCount: columnLayout.count,
        rowGaps: rowLayout.gaps,
        columnGaps: columnLayout.gaps,
        medianChildWidth,
        medianChildHeight,
        medianRowGap,
        medianColumnGap,
        rowGapToChildHeight: medianRowGap !== null && medianChildHeight
          ? round(medianRowGap / medianChildHeight) : null,
        columnGapToChildWidth: medianColumnGap !== null && medianChildWidth
          ? round(medianColumnGap / medianChildWidth) : null,
        paintedAreaRatio: round(children.reduce((sum, child) =>
          sum + child.regions.reduce((nodeSum, region) => nodeSum + region.width * region.height, 0), 0)
          / (box.width * box.height)),
      },
      occupancy: childBounds ? {
        width: round(childBounds.width / box.width),
        height: round(childBounds.height / box.height),
        topInset: round(childBounds.y - box.y),
        bottomInset: round(box.bottom - childBounds.bottom),
      } : null,
      outsideChildren: ownedChildren.filter((node) => (
        node.box.x < box.x || node.box.right > box.right || node.box.y < box.y || node.box.bottom > box.bottom
      )).map((node) => node.id),
    };
  });
  const overlaps = [];
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const area = nodes[left].regions.reduce((sum, leftRegion) =>
        sum + nodes[right].regions.reduce((regionSum, rightRegion) =>
          regionSum + overlapArea(leftRegion, rightRegion), 0), 0);
      if (area > 4) overlaps.push({ left: nodes[left].id, right: nodes[right].id, area: round(area) });
    }
  }
  const contentBounds = union([
    ...nodes.filter((node) => !node.nested).map((node) => node.box),
    ...frames.map((frame) => frame.box),
  ]);
  const whitespace = canvas && contentBounds ? {
    top: round(contentBounds.y - canvas.y),
    right: round(canvas.right - contentBounds.right),
    bottom: round(canvas.bottom - contentBounds.bottom),
    left: round(contentBounds.x - canvas.x),
    contentWidthRatio: round(contentBounds.width / canvas.width),
    contentHeightRatio: round(contentBounds.height / canvas.height),
  } : null;
  const custom = (measurements ?? []).map((measurement) => {
    const elements = [...document.querySelectorAll(measurement.selector)].filter(visible);
    const selected = measurement.all ? elements : elements.slice(0, 1);
    return {
      name: measurement.name,
      selector: measurement.selector,
      count: elements.length,
      values: selected.map((element) => ({
        text: measurement.text === false ? undefined : element.textContent?.trim().replace(/\s+/g, " ").slice(0, 240),
        box: rect(element),
        styles: Object.fromEntries((measurement.styles ?? []).map((name) => [name, getComputedStyle(element).getPropertyValue(name).trim()])),
      })),
    };
  });
  const limits = {
    minimumFrameOccupancy: 0.45,
    maximumGapRatio: 1.5,
    ...(thresholds ?? {}),
  };
  // The layout reserves the size a node declares. If the DOM paints something
  // larger, every gap the layout computed is too small by the difference, and
  // no amount of tuning downstream will fix it.
  const scale = stage ? Number(getComputedStyle(document.querySelector('[data-vqa="graph-stage"]'))
    .getPropertyValue("--stage-zoom")) || 1 : 1;
  const understated = nodes.filter((node) => {
    if (!node.declaredExtent) return false;
    return node.box.width / scale > node.declaredExtent.width + 1
      || node.box.height / scale > node.declaredExtent.height + 1;
  }).map((node) => `${node.id}: painted ${round(node.box.width / scale)}x${round(node.box.height / scale)}`
    + ` but declares ${node.declaredExtent.width}x${node.declaredExtent.height}`);

  const warnings = [
    ...understated.map((item) => `extent understated — ${item}`),
    ...frames.filter((frame) => frame.occupancy && frame.occupancy.height < limits.minimumFrameOccupancy)
      .map((frame) => `${frame.roomId}: children occupy only ${frame.occupancy.height} of frame height`),
    ...frames.filter((frame) => frame.spacing.rowGapToChildHeight > limits.maximumGapRatio)
      .map((frame) => `${frame.roomId}: median row gap is ${frame.spacing.rowGapToChildHeight}× child height`),
    ...frames.filter((frame) => frame.spacing.columnGapToChildWidth > limits.maximumGapRatio)
      .map((frame) => `${frame.roomId}: median column gap is ${frame.spacing.columnGapToChildWidth}× child width`),
    ...frames.filter((frame) => frame.outsideChildren.length > 0)
      .map((frame) => `${frame.roomId}: children outside frame: ${frame.outsideChildren.join(", ")}`),
    ...overlaps.map((item) => `node overlap: ${item.left} / ${item.right} (${item.area}px²)`),
  ];
  return {
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    stage,
    stageZoom: stageElement ? getComputedStyle(stageElement).getPropertyValue("--stage-zoom").trim() : null,
    lod: stageElement?.dataset.vqaLod ?? null,
    canvas,
    contentBounds,
    whitespace,
    nodes,
    frames,
    detailPlates: [...document.querySelectorAll('[data-vqa="detail-plate"]')].filter(visible).map((element) => ({
      nodeId: element.dataset.vqaNodeId,
      box: rect(element),
      text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 300),
    })),
    overlaps,
    warnings,
    measurements: custom,
  };
}

function markdown(report) {
  const lines = [
    `# Visual QA: ${report.scenario.title}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
  ];
  if (report.error) lines.push(`Run failed: ${report.error}`, "");
  for (const checkpoint of report.checkpoints) {
    const metrics = checkpoint.metrics;
    lines.push(`## ${checkpoint.name}`, "");
    if (checkpoint.screenshot) lines.push(`![${checkpoint.name}](./${path.basename(checkpoint.screenshot)})`, "");
    lines.push(
      `- Stage: ${metrics.stage?.width ?? 0} × ${metrics.stage?.height ?? 0}px; zoom ${metrics.stageZoom}; LOD ${metrics.lod}`,
      `- Content/canvas: ${metrics.whitespace?.contentWidthRatio ?? "n/a"} wide × ${metrics.whitespace?.contentHeightRatio ?? "n/a"} high`,
      `- Visible nodes: ${metrics.nodes.length}; frames: ${metrics.frames.length}; overlaps: ${metrics.overlaps.length}`,
      ""
    );
    if (metrics.frames.length > 0) {
      lines.push("| Room | Frame | Children | Occupancy | Row/column gaps | Gap ratio |", "|---|---:|---:|---:|---:|---:|");
      for (const frame of metrics.frames) {
        lines.push(`| ${frame.roomId} | ${frame.box.width}×${frame.box.height} | ${frame.measuredChildren.length}/${frame.childCount} | ${frame.occupancy?.width ?? "n/a"}×${frame.occupancy?.height ?? "n/a"} | ${frame.spacing.rowGaps.join(", ")} / ${frame.spacing.columnGaps.join(", ")} | ${frame.spacing.rowGapToChildHeight ?? "n/a"}× / ${frame.spacing.columnGapToChildWidth ?? "n/a"}× |`);
      }
      lines.push("");
    }
    if (metrics.warnings.length > 0) {
      lines.push("Warnings:", "", ...metrics.warnings.map((warning) => `- ${warning}`), "");
    }
  }
  return `${lines.join("\n")}\n`;
}

app.whenReady().then(async () => {
  mkdirSync(outDir, { recursive: true });
  const viewport = scenario.viewport ?? { width: 1800, height: 1125 };
  const window = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  window.webContents.setFrameRate(10);
  const report = {
    schemaVersion: 1,
    scenario: { id: scenario.id, title: scenario.title },
    generatedAt: new Date().toISOString(),
    checkpoints: [],
  };
  try {
    await window.loadURL(url);
    await waitForSelector(window.webContents, scenario.readySelector ?? '[data-vqa="graph-stage"]');
    await sleep(scenario.initialWait ?? 700);
    for (const step of scenario.steps) {
      const script = actionScript(step.action);
      const actionResult = script ? await window.webContents.executeJavaScript(script, true) : null;
      if (step.waitFor) await waitForSelector(window.webContents, step.waitFor, step.timeout);
      await sleep(step.wait ?? 500);
      const metrics = await window.webContents.executeJavaScript(
        `(${collectPageReport.toString()})(`
        + `${JSON.stringify(step.measurements ?? scenario.measurements ?? [])}, `
        + `${JSON.stringify(scenario.thresholds ?? {})})`,
        true
      );
      let screenshot = null;
      if (step.screenshot !== false) {
        screenshot = path.join(outDir, `${String(report.checkpoints.length + 1).padStart(2, "0")}-${step.name}.png`);
        const image = await window.webContents.capturePage();
        writeFileSync(screenshot, image.toPNG());
        metrics.screenshotPixels = image.getSize();
        metrics.screenshotScale = {
          x: Math.round((image.getSize().width / metrics.viewport.width) * 1_000) / 1_000,
          y: Math.round((image.getSize().height / metrics.viewport.height) * 1_000) / 1_000,
        };
      }
      report.checkpoints.push({ name: step.name, actionResult, screenshot, metrics });
      console.log(
        `VQA ${step.name}: ${metrics.nodes.length} nodes, ${metrics.frames.length} frames, `
        + `${metrics.overlaps.length} overlaps, ${metrics.warnings.length} warnings`
      );
    }
    const jsonPath = path.join(outDir, "report.json");
    const markdownPath = path.join(outDir, "report.md");
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(markdownPath, markdown(report));
    console.log(`VQA_REPORT_JSON ${jsonPath}`);
    console.log(`VQA_REPORT_MARKDOWN ${markdownPath}`);
    app.exit(0);
  } catch (error) {
    report.error = error?.stack ?? String(error);
    try {
      const failureImage = await window.webContents.capturePage();
      writeFileSync(path.join(outDir, "failure.png"), failureImage.toPNG());
      writeFileSync(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
      writeFileSync(path.join(outDir, "report.md"), markdown(report));
      console.error(`VQA_FAILED_ARTIFACTS ${outDir}`);
    } catch (writeError) {
      console.error(`Could not save failure artifacts: ${writeError?.stack ?? String(writeError)}`);
    }
    console.error(report.error);
    app.exit(1);
  }
});
