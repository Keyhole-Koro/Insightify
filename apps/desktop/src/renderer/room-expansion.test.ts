import { describe, expect, it } from "vitest";
import {
  getExpandedRoomFrames,
  layoutFlowNodesWithExpandedScopes,
  parseFlowGraph,
  projectFlowWithExpandedScopes,
  type FlowNode,
} from "@insightify/graph-domain";
import { NESTED_PITCH_X, NESTED_PITCH_Y, stageMetrics } from "./semantic-zoom.js";

// Unfolding a Room in place must not change how the rest of the canvas is
// drawn. It has broken twice: once because the Room's own children were fed
// into the stage calculation, where their deliberately tight pitch was read as
// the gap between two ordinary cards, and once because reflowing the siblings
// around the frame squeezed a pair close enough to force a stage twice as wide.
// Both showed up the same way — every card outside the Room shrank and the
// canvas spread out — so this is written against that symptom.

const CANVAS = { width: 1280, height: 760 };
const ROOT_CARD = { width: 190, height: 82 };

const node = (id: string, parentId: string | null, kind: FlowNode["kind"] = "service"): FlowNode => ({
  id,
  title: id,
  summary: `${id} summary`,
  kind,
  parentId,
  evidence: [],
});

function graphWith(childCount: number) {
  const children = Array.from({ length: childCount }, (_, index) =>
    node(`child-${index}`, "gateway", "api")
  );
  return parseFlowGraph({
    title: "Room expansion",
    summary: "A Room with siblings around it",
    nodes: [
      node("gateway", null, "room"),
      node("portal", null, "ui"),
      node("engine", null, "service"),
      node("store", null, "database"),
      node("bus", null, "queue"),
      node("cloud", null, "external"),
      ...children,
    ],
    edges: [
      { source: "portal", target: "gateway", label: "" },
      { source: "gateway", target: "engine", label: "" },
      { source: "engine", target: "store", label: "" },
      { source: "engine", target: "bus", label: "" },
      { source: "bus", target: "cloud", label: "" },
    ],
  });
}

function render(childCount: number, open: Set<string>) {
  const graph = graphWith(childCount);
  const projection = projectFlowWithExpandedScopes(graph, null, open);
  const frames = getExpandedRoomFrames(projection.nodes, null, open, [], {});
  const positioned = layoutFlowNodesWithExpandedScopes(projection.nodes, null, open, [], {});
  const roots = positioned.filter((item) => item.parentId === null && !open.has(item.id));
  const stage = stageMetrics(
    roots.map((item) => ({ ...item, ...ROOT_CARD })),
    CANVAS,
    frames
  );
  return { frames, roots, stage, cardWidth: ROOT_CARD.width * stage.scale };
}

describe("unfolding a Room in place", () => {
  it("leaves the cards around it at very nearly the size they had", () => {
    for (const childCount of [2, 4, 7]) {
      const closed = render(childCount, new Set());
      const open = render(childCount, new Set(["gateway"]));
      // A little movement is expected — the siblings do have to make room.
      // Halving, which is what a runaway stage produced, is not.
      expect(open.cardWidth).toBeGreaterThan(closed.cardWidth * 0.8);
    }
  });

  it("does not let the stage run away when the siblings are pushed aside", () => {
    for (const childCount of [2, 4, 7]) {
      const closed = render(childCount, new Set());
      const open = render(childCount, new Set(["gateway"]));
      expect(open.stage.width).toBeLessThan(closed.stage.width * 1.35);
      expect(open.stage.height).toBeLessThan(closed.stage.height * 1.35);
    }
  });

  // The stage scales the frame and the pills inside it together, so whether
  // they fit is decided in stage coordinates and does not depend on the zoom.
  it("gives the frame room for every pill inside it", () => {
    for (const childCount of [2, 4, 7]) {
      const { frames, stage } = render(childCount, new Set(["gateway"]));
      const frame = frames[0]!;
      expect((frame.bounds.width / 100) * stage.width).toBeGreaterThanOrEqual(
        frame.columns * NESTED_PITCH_X
      );
      expect((frame.bounds.height / 100) * stage.height).toBeGreaterThanOrEqual(
        frame.rows * NESTED_PITCH_Y
      );
    }
  });

  it("keeps every sibling clear of its neighbours", () => {
    const { roots, stage } = render(7, new Set(["gateway"]));
    for (let left = 0; left < roots.length; left += 1) {
      for (let right = left + 1; right < roots.length; right += 1) {
        const a = roots[left]!;
        const b = roots[right]!;
        const apart =
          (Math.abs(b.x - a.x) / 100) * stage.width >= ROOT_CARD.width ||
          (Math.abs(b.y - a.y) / 100) * stage.height >= ROOT_CARD.height;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
  });
});
