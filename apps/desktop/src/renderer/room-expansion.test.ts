import { describe, expect, it } from "vitest";
import {
  createDefaultGraphLayout,
  getExpandedRoomFrames,
  getExpandedRoomShapes,
  getScopeBasePositions,
  layoutFlowNodesWithExpandedScopes,
  NESTED_CARD_HEIGHT,
  NESTED_CARD_WIDTH,
  roomFramePixelSize,
  stagePixelsForRoom,
  parseFlowGraph,
  projectFlowWithExpandedScopes,
  resolveRoomLayoutRules,
  type FlowNode,
} from "@insightify/graph-domain";
import { stageMetrics } from "./semantic-zoom.js";

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

// The same order the canvas uses: a Room's shape needs neither the stage nor a
// frame, the stage is sized from those shapes, and the frames are sized against
// the stage. Measuring in any other order is measuring a canvas that never
// existed.
function render(childCount: number, open: Set<string>) {
  const graph = graphWith(childCount);
  const rules = resolveRoomLayoutRules(graph);
  const savedLayout = createDefaultGraphLayout(graph, {}, rules);
  const projection = projectFlowWithExpandedScopes(graph, null, open);
  const shapes = getExpandedRoomShapes(projection.nodes, null, open, [], rules);
  const stage = stageMetrics(
    getScopeBasePositions(projection.nodes, null, [], savedLayout, rules)
      .filter((item) => !open.has(item.id))
      .map((item) => ({ ...item, ...ROOT_CARD })),
    CANVAS,
    shapes
  );
  const metrics = { stageWidth: stage.width, stageHeight: stage.height };
  const frames = getExpandedRoomFrames(projection.nodes, null, open, [], savedLayout, rules, metrics);
  const positioned = layoutFlowNodesWithExpandedScopes(
    projection.nodes,
    null,
    open,
    [],
    savedLayout,
    rules,
    metrics
  );
  const roots = positioned.filter((item) => item.parentId === null && !open.has(item.id));
  return { frames, roots, positioned, stage, cardWidth: ROOT_CARD.width * stage.scale };
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

  it("grows the stage by what the Room needs and no more", () => {
    for (const childCount of [2, 4, 7]) {
      const closed = render(childCount, new Set());
      const open = render(childCount, new Set(["gateway"]));
      const frame = open.frames[0]!;
      // The old failure was a stage that ran away for no stated reason. The
      // property is not a multiple of the closed stage — a Room of three lanes
      // genuinely needs a wider one — but that every pixel of the growth is
      // explained by what the Room has to hold within its allowed share.
      const required = stagePixelsForRoom(frame.columns, frame.rows);
      expect(open.stage.width).toBeGreaterThanOrEqual(closed.stage.width - 0.01);
      expect(open.stage.width).toBeLessThanOrEqual(Math.max(closed.stage.width, required.width) + 1);
      expect(open.stage.height).toBeLessThanOrEqual(
        Math.max(closed.stage.height, required.height) + 1
      );
    }
  });

  // The stage scales the frame and the pills inside it together, so whether
  // they fit is decided in stage coordinates and does not depend on the zoom.
  // This is the property itself rather than a proxy for it: the frame used to
  // be sized by one formula and its children placed by another, and every card
  // in a two-lane Room hung outside the frame that was supposed to hold it.
  it("keeps every child card inside the frame that holds it", () => {
    for (const childCount of [1, 2, 3, 4, 5, 7]) {
      const { frames, positioned, stage } = render(childCount, new Set(["gateway"]));
      const frame = frames[0]!;
      const left = (frame.bounds.x / 100) * stage.width;
      const top = (frame.bounds.y / 100) * stage.height;
      const right = left + (frame.bounds.width / 100) * stage.width;
      const bottom = top + (frame.bounds.height / 100) * stage.height;
      for (const child of positioned.filter((item) => item.parentId === "gateway")) {
        const centreX = (child.x / 100) * stage.width;
        const centreY = (child.y / 100) * stage.height;
        const label = `${child.id} of ${childCount}`;
        expect(centreX - NESTED_CARD_WIDTH / 2, label).toBeGreaterThanOrEqual(left - 0.5);
        expect(centreX + NESTED_CARD_WIDTH / 2, label).toBeLessThanOrEqual(right + 0.5);
        expect(centreY - NESTED_CARD_HEIGHT / 2, label).toBeGreaterThanOrEqual(top - 0.5);
        expect(centreY + NESTED_CARD_HEIGHT / 2, label).toBeLessThanOrEqual(bottom + 0.5);
      }
    }
  });

  it("does not reserve a large empty band around what it holds", () => {
    for (const childCount of [2, 4, 7]) {
      const { frames, stage } = render(childCount, new Set(["gateway"]));
      const frame = frames[0]!;
      const frameWidth = (frame.bounds.width / 100) * stage.width;
      // Against everything the frame holds, which is its header as well as its
      // cards: a one-column Room is wider than its cards on purpose, because
      // otherwise its own title has 18px of the 109 it needs.
      expect(frameWidth).toBeLessThan(roomFramePixelSize(frame.columns, frame.rows).width * 1.3);
    }
  });

  it("uses a balanced Room-specific grid instead of stretching endpoints into root tiers", () => {
    const { frames, positioned } = render(7, new Set(["gateway"]));
    expect(frames[0]).toMatchObject({ columns: 3, rows: 3 });
    const children = positioned.filter((node) => node.parentId === "gateway");
    expect(new Set(children.map((node) => node.x)).size).toBe(3);
    expect(new Set(children.map((node) => node.y)).size).toBe(3);
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
