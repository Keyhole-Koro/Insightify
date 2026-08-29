import { describe, expect, it } from "vitest";
import {
  applyLayoutAreaLocks,
  parseSemanticLayoutPlan,
  type LayoutAreaLock,
  type SemanticLayoutPlan,
} from "./index.js";

const area = (id: string, nodeIds: string[]) => ({
  id,
  label: id,
  direction: "column" as const,
  nodeIds,
});

const current: SemanticLayoutPlan = parseSemanticLayoutPlan({
  version: 1,
  scopes: [
    {
      roomId: null,
      direction: "row",
      areas: [area("entry", ["ui", "gateway"]), area("state", ["db", "queue"])],
    },
    { roomId: "gateway", direction: "row", areas: [area("rest", ["login", "logout"])] },
  ],
});

// The model has reshuffled everything: nodes move between areas and the area
// names change.
const incoming: SemanticLayoutPlan = parseSemanticLayoutPlan({
  version: 1,
  scopes: [
    {
      roomId: null,
      direction: "column",
      areas: [area("front", ["ui", "db"]), area("back", ["gateway", "queue"])],
    },
    { roomId: "gateway", direction: "column", areas: [area("all", ["login", "logout"])] },
  ],
});

const rootScope = (plan: SemanticLayoutPlan) => plan.scopes.find((scope) => scope.roomId === null)!;

describe("applyLayoutAreaLocks", () => {
  it("takes the incoming plan whole when nothing is locked", () => {
    expect(applyLayoutAreaLocks(current, incoming, [])).toBe(incoming);
  });

  it("keeps a locked area exactly as it was", () => {
    const merged = applyLayoutAreaLocks(current, incoming, [{ roomId: null, areaId: "entry" }]);
    expect(rootScope(merged).areas[0]).toEqual(area("entry", ["ui", "gateway"]));
  });

  it("takes the locked nodes out of the areas the model wanted to put them in", () => {
    const merged = applyLayoutAreaLocks(current, incoming, [{ roomId: null, areaId: "entry" }]);
    const rearranged = rootScope(merged).areas.slice(1);
    expect(rearranged.map((item) => item.id)).toEqual(["front", "back"]);
    // "ui" and "gateway" are pinned, so only the unpinned nodes remain.
    expect(rearranged.flatMap((item) => item.nodeIds).sort()).toEqual(["db", "queue"]);
  });

  it("assigns every node exactly once across the merged scope", () => {
    const merged = applyLayoutAreaLocks(current, incoming, [{ roomId: null, areaId: "entry" }]);
    const assigned = rootScope(merged).areas.flatMap((item) => item.nodeIds);
    expect([...assigned].sort()).toEqual(["db", "gateway", "queue", "ui"]);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it("drops an area the model emptied by locking, rather than keeping a blank lane", () => {
    const merged = applyLayoutAreaLocks(
      current,
      parseSemanticLayoutPlan({
        version: 1,
        scopes: [{ roomId: null, direction: "row", areas: [area("only", ["ui", "gateway"])] }],
      }),
      [{ roomId: null, areaId: "entry" }]
    );
    expect(rootScope(merged).areas.map((item) => item.id)).toEqual(["entry"]);
  });

  it("locks a Room's area independently of the root", () => {
    const merged = applyLayoutAreaLocks(current, incoming, [
      { roomId: "gateway", areaId: "rest" },
    ]);
    expect(merged.scopes.find((scope) => scope.roomId === "gateway")!.areas).toEqual([
      area("rest", ["login", "logout"]),
    ]);
    // The unlocked root scope is still free to change.
    expect(rootScope(merged).areas.map((item) => item.id)).toEqual(["front", "back"]);
  });

  it("keeps a locked scope the model left out entirely", () => {
    const merged = applyLayoutAreaLocks(
      current,
      parseSemanticLayoutPlan({
        version: 1,
        scopes: [{ roomId: null, direction: "row", areas: [area("front", ["ui"])] }],
      }),
      [{ roomId: "gateway", areaId: "rest" }]
    );
    expect(merged.scopes.find((scope) => scope.roomId === "gateway")!.areas).toEqual([
      area("rest", ["login", "logout"]),
    ]);
  });

  it("ignores a lock whose area no longer exists", () => {
    const locks: LayoutAreaLock[] = [{ roomId: null, areaId: "deleted-area" }];
    expect(rootScope(applyLayoutAreaLocks(current, incoming, locks)).areas).toEqual(
      rootScope(incoming).areas
    );
  });

  it("never exceeds the four areas a scope is allowed", () => {
    const crowded = parseSemanticLayoutPlan({
      version: 1,
      scopes: [{
        roomId: null,
        direction: "row",
        areas: [area("a", ["db"]), area("b", ["queue"]), area("c", ["x"]), area("d", ["y"])],
      }],
    });
    const merged = applyLayoutAreaLocks(current, crowded, [{ roomId: null, areaId: "entry" }]);
    expect(rootScope(merged).areas.length).toBeLessThanOrEqual(4);
    expect(rootScope(merged).areas[0]!.id).toBe("entry");
  });
});
