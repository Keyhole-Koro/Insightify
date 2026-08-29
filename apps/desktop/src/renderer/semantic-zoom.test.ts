import { describe, expect, it } from "vitest";
import { nextSemanticLevel, semanticLevelForZoom, stageMetrics } from "./semantic-zoom.js";

describe("semantic zoom levels", () => {
  it("moves from structure to implementation as a Portal grows", () => {
    expect(nextSemanticLevel("structure", 90)).toBe("structure");
    expect(nextSemanticLevel("structure", 112)).toBe("flow");
    expect(nextSemanticLevel("flow", 230)).toBe("implementation");
  });

  it("holds the level inside the hysteresis band", () => {
    expect(nextSemanticLevel("implementation", 210)).toBe("implementation");
    expect(nextSemanticLevel("implementation", 200)).toBe("flow");
    expect(nextSemanticLevel("flow", 100)).toBe("flow");
    expect(nextSemanticLevel("flow", 96)).toBe("structure");
  });

  it("reads the level from the canvas zoom", () => {
    expect(semanticLevelForZoom("flow", 0.45)).toBe("structure");
    expect(semanticLevelForZoom("flow", 1)).toBe("flow");
    expect(semanticLevelForZoom("flow", 1.45)).toBe("implementation");
  });
});

describe("stage metrics", () => {
  const frame = { width: 960, height: 700 };

  it("fits a Room whose flow needs more room than the frame", () => {
    const metrics = stageMetrics([15, 32.5, 50, 67.5, 85].map((x) => ({ x, y: 50 })), frame);
    expect(metrics.scale).toBeLessThan(1);
    // Fitting a dense Room shrinks the projected Portal, which is what lowers
    // the semantic level rather than letting cards collide.
    expect(metrics.width * metrics.scale).toBeCloseTo(864, 5);
    expect(semanticLevelForZoom("flow", metrics.scale)).toBe("flow");
    const crowded = stageMetrics(Array.from({ length: 7 }, (_unused, index) => ({ x: 15 + index * 11.7, y: 50 })), frame);
    expect(semanticLevelForZoom("flow", crowded.scale)).toBe("structure");
  });

  it("enlarges a short flow so it gains detail instead of leaving the canvas empty", () => {
    const metrics = stageMetrics([{ x: 15, y: 50 }, { x: 50, y: 50 }, { x: 85, y: 50 }], frame);
    expect(metrics.scale).toBeGreaterThan(1);
    expect(semanticLevelForZoom("flow", metrics.scale)).toBe("implementation");
  });

  it("does not count staggered lanes as a stack of global rows", () => {
    const nodes = [
      ...[47, 54.5, 62, 69.5].map((y) => ({ x: 8.5, y })),
      ...[50.5, 58, 65.5].map((y) => ({ x: 30, y })),
    ];
    const metrics = stageMetrics(nodes, { width: 1200, height: 760 });

    expect(metrics.height).toBeLessThan(1500);
    expect(metrics.height * metrics.scale).toBeCloseTo(664, 5);
  });
});
