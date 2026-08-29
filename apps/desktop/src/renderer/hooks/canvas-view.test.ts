import { describe, expect, it } from "vitest";
import {
  canvasViewReducer,
  initialCanvasState,
  type CanvasAction,
  type CanvasState,
} from "./useCanvasView.js";

function run(actions: CanvasAction[], from: CanvasState = initialCanvasState): CanvasState {
  return actions.reduce(canvasViewReducer, from);
}

describe("canvasViewReducer", () => {
  it("starts with every Room folded", () => {
    expect(initialCanvasState.expandedScopeIds.size).toBe(0);
    expect(initialCanvasState.closingScopeIds.size).toBe(0);
  });

  it("moves a Room into the closing set so its fold can still be drawn", () => {
    const opened = run([{ type: "toggleRoom", roomId: "gateway" }]);
    expect([...opened.expandedScopeIds]).toEqual(["gateway"]);

    const closing = canvasViewReducer(opened, { type: "toggleRoom", roomId: "gateway" });
    expect([...closing.expandedScopeIds]).toEqual([]);
    expect([...closing.closingScopeIds]).toEqual(["gateway"]);

    const folded = canvasViewReducer(closing, { type: "finishClosingRoom", roomId: "gateway" });
    expect([...folded.closingScopeIds]).toEqual([]);
  });

  it("never leaves a Room open and closing at once when it is reopened mid-fold", () => {
    const reopened = run([
      { type: "toggleRoom", roomId: "gateway" },
      { type: "toggleRoom", roomId: "gateway" },
      { type: "toggleRoom", roomId: "gateway" },
    ]);
    expect([...reopened.expandedScopeIds]).toEqual(["gateway"]);
    expect([...reopened.closingScopeIds]).toEqual([]);
  });

  it("folds every open Room at once", () => {
    const closed = run([
      { type: "openRooms", roomIds: ["gateway", "engine"] },
      { type: "closeAllRooms" },
    ]);
    expect([...closed.expandedScopeIds]).toEqual([]);
    expect([...closed.closingScopeIds].sort()).toEqual(["engine", "gateway"]);
  });

  it("entering a scope clears the selection and resets zoom, setScope does not", () => {
    const zoomed = run([
      { type: "selectNode", nodeId: "router" },
      { type: "setZoom", zoom: 2.5 },
    ]);

    const entered = canvasViewReducer(zoomed, { type: "enterScope", scopeId: "gateway", selectedNodeId: null });
    expect(entered).toMatchObject({ scopeId: "gateway", selectedNodeId: null, zoom: 1 });

    const moved = canvasViewReducer(zoomed, { type: "setScope", scopeId: null });
    expect(moved).toMatchObject({ scopeId: null, selectedNodeId: "router", zoom: 2.5 });
  });

  it("selecting a node closes the peek panel", () => {
    const state = run([
      { type: "peekNode", nodeId: "store" },
      { type: "selectNode", nodeId: "router" },
    ]);
    expect(state.peekNodeId).toBeNull();
  });

  it("clamps zoom to the usable range", () => {
    expect(run([{ type: "zoomBy", delta: -5 }]).zoom).toBe(0.2);
    expect(run([{ type: "zoomBy", delta: 99 }]).zoom).toBe(5);
    expect(run([{ type: "zoomBy", delta: 0.25 }]).zoom).toBe(1.25);
  });

  it("toggles a node's expansion without disturbing the others", () => {
    const state = run([
      { type: "toggleNode", nodeId: "router" },
      { type: "toggleNode", nodeId: "store" },
      { type: "toggleNode", nodeId: "router" },
    ]);
    expect([...state.expandedNodeIds]).toEqual(["store"]);
  });
});
