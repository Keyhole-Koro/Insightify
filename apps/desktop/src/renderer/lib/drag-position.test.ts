import { describe, expect, it } from "vitest";
import type { ExpandedRoomFrame } from "@insightify/graph-domain";
import { pointerToStage, resolveDragPosition } from "./drag-position.js";

const frame = (over: Partial<ExpandedRoomFrame> = {}): ExpandedRoomFrame => ({
  roomId: "gateway",
  title: "Gateway",
  bounds: { x: 30, y: 20, width: 20, height: 16 },
  contentBounds: { x: 32, y: 26, width: 16, height: 8 },
  childCount: 2,
  columns: 1,
  rows: 2,
  ...over,
});

describe("resolveDragPosition", () => {
  it("stores a node dropped inside a Room in that Room's local space", () => {
    // The centre of contentBounds is 50/50 locally, whatever the frame's position.
    expect(resolveDragPosition({ x: 40, y: 30 }, { parent: frame() })).toEqual({ x: 50, y: 50 });
  });

  it("clamps a nested node to the Room rather than letting it escape", () => {
    expect(resolveDragPosition({ x: 10, y: 90 }, { parent: frame() })).toEqual({ x: 4, y: 96 });
  });

  it("keeps a dragged Room frame fully on the canvas, not just its centre", () => {
    const own = frame();
    expect(resolveDragPosition({ x: 0, y: 0 }, { own })).toEqual({ x: 11, y: 11 });
    expect(resolveDragPosition({ x: 100, y: 100 }, { own })).toEqual({ x: 89, y: 89 });
  });

  it("clamps a plain node to the stage margins", () => {
    expect(resolveDragPosition({ x: -5, y: 200 }, {})).toEqual({ x: 8, y: 87 });
    expect(resolveDragPosition({ x: 55, y: 44 }, {})).toEqual({ x: 55, y: 44 });
  });
});

describe("pointerToStage", () => {
  const rect = { left: 0, top: 0, width: 1000, height: 600 };

  it("maps the centre of the frame to the centre of the stage", () => {
    expect(pointerToStage({ clientX: 500, clientY: 300 }, rect, { width: 1000, height: 600 }, 1)).toEqual({
      x: 50,
      y: 50,
    });
  });

  it("accounts for zoom, so a zoomed-in drag moves fewer percent per pixel", () => {
    const unzoomed = pointerToStage({ clientX: 750, clientY: 300 }, rect, { width: 1000, height: 600 }, 1);
    const zoomed = pointerToStage({ clientX: 750, clientY: 300 }, rect, { width: 1000, height: 600 }, 2);
    expect(unzoomed.x).toBe(75);
    expect(zoomed.x).toBe(62.5);
  });
});
