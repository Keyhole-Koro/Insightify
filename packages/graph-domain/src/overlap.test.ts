import { describe, expect, it } from "vitest";
import { resolveOverlaps, type OverlapBox } from "./index.js";

const STAGE = { stageWidth: 1000, stageHeight: 1000 };
const card = (
  id: string,
  x: number,
  y: number,
  width = 190,
  height = 92,
  offsetY = 0
): OverlapBox => ({ id, x, y, extent: { width, height, offsetY } });

// Boxes are 1% of the stage per 10px, so a 190x92 card is 19% x 9.2% wide and
// tall. Distances below are in those percentages.
const apart = (
  positions: Map<string, { x: number; y: number }>,
  boxes: OverlapBox[]
): boolean =>
  boxes.every((left, index) =>
    boxes.slice(index + 1).every((right) => {
      const a = positions.get(left.id)!;
      const b = positions.get(right.id)!;
      const centreA = a.y + (left.extent.offsetY / STAGE.stageHeight) * 100;
      const centreB = b.y + (right.extent.offsetY / STAGE.stageHeight) * 100;
      const needX = ((left.extent.width + right.extent.width) / 2 / STAGE.stageWidth) * 100;
      const needY = ((left.extent.height + right.extent.height) / 2 / STAGE.stageHeight) * 100;
      return Math.abs(a.x - b.x) >= needX - 0.01 || Math.abs(centreA - centreB) >= needY - 0.01;
    })
  );

describe("resolveOverlaps", () => {
  it("leaves boxes that already clear each other exactly where they were", () => {
    const boxes = [card("left", 20, 50), card("right", 70, 50)];
    const result = resolveOverlaps(boxes, new Set(), STAGE);
    expect(result.get("left")).toEqual({ x: 20, y: 50 });
    expect(result.get("right")).toEqual({ x: 70, y: 50 });
  });

  it("pushes an overlapping pair apart", () => {
    const boxes = [card("left", 48, 50), card("right", 52, 50)];
    const result = resolveOverlaps(boxes, new Set(), STAGE);
    expect(apart(result, boxes)).toBe(true);
  });

  // The whole point of anchoring: the thing the user just opened is the thing
  // they are looking at, and it must not slide out from under them.
  it("places a box that hangs below its coordinate where it is actually drawn", () => {
    // A plate opens downwards, so the neighbour underneath must be pushed even
    // though the two coordinates are far enough apart on their own.
    const boxes = [card("open", 50, 50, 240, 308, 108), card("neighbour", 50, 66)];
    const result = resolveOverlaps(boxes, new Set(["open"]), STAGE);
    expect(result.get("neighbour")!.y).toBeGreaterThan(66);
    expect(apart(result, boxes)).toBe(true);
  });

  it("never moves an anchored box, and moves the other one instead", () => {
    const boxes = [card("open", 50, 50, 240, 308, 108), card("neighbour", 50, 62)];
    const result = resolveOverlaps(boxes, new Set(["open"]), STAGE);
    expect(result.get("open")).toEqual({ x: 50, y: 50 });
    expect(result.get("neighbour")).not.toEqual({ x: 50, y: 62 });
    expect(apart(result, boxes)).toBe(true);
  });

  it("separates along the axis that needs the least movement", () => {
    // Deeply overlapped horizontally, barely overlapped vertically.
    const boxes = [card("left", 50, 50), card("right", 51, 58)];
    const result = resolveOverlaps(boxes, new Set(), STAGE);
    const moved = result.get("right")!;
    expect(Math.abs(moved.y - 58)).toBeGreaterThan(Math.abs(moved.x - 51));
  });

  it("propagates a push down a row", () => {
    const boxes = [card("a", 30, 50), card("b", 40, 50), card("c", 50, 50)];
    const result = resolveOverlaps(boxes, new Set(["a"]), STAGE);
    expect(result.get("a")).toEqual({ x: 30, y: 50 });
    expect(apart(result, boxes)).toBe(true);
  });

  it("keeps every box on the stage", () => {
    const boxes = Array.from({ length: 6 }, (_, index) => card(`node-${index}`, 50, 50));
    const result = resolveOverlaps(boxes, new Set(), STAGE);
    for (const [, position] of result) {
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(100);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThanOrEqual(100);
    }
  });

  it("is a pure function of its input, so collapsing restores the arrangement", () => {
    const collapsed = [card("open", 50, 50), card("neighbour", 50, 62)];
    const expanded = [card("open", 50, 50, 240, 308, 108), card("neighbour", 50, 62)];
    const after = resolveOverlaps(expanded, new Set(["open"]), STAGE);
    expect(after.get("neighbour")).not.toEqual({ x: 50, y: 62 });
    const restored = resolveOverlaps(collapsed, new Set(["open"]), STAGE);
    expect(restored.get("neighbour")).toEqual({ x: 50, y: 62 });
  });
});
