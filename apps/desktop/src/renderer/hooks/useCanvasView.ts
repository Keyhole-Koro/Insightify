import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { clearDive, prefersReducedMotion } from "../lib/flowfold-helpers.js";

// Everything on this page that is a *view* of the graph rather than part of it:
// where the camera is, what is selected, which Rooms are unfolded. None of it is
// persisted, so it lives here instead of in the saved document.

export type DiveState = { phase: "exit" | "enter"; scale: number; x: number; y: number };

export const DIVE_MS = 200;
export const DIVE_SCALE_IN = 2.6;
export const DIVE_SCALE_OUT = 0.42;
export const ROOM_TRANSITION_MS = 180;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

export type CanvasState = {
  scopeId: string | null;
  selectedNodeId: string | null;
  peekNodeId: string | null;
  expandedNodeIds: Set<string>;
  expandedScopeIds: Set<string>;
  /** Rooms mid-fold: still drawn, no longer open. */
  closingScopeIds: Set<string>;
  showDebugAreas: boolean;
  zoom: number;
  dive: DiveState | null;
  hoveredEdgeKey: string | null;
};

export type CanvasAction =
  | { type: "reset" }
  | { type: "enterScope"; scopeId: string | null; selectedNodeId: string | null }
  | { type: "setScope"; scopeId: string | null }
  | { type: "selectNode"; nodeId: string | null }
  | { type: "peekNode"; nodeId: string | null }
  | { type: "toggleNode"; nodeId: string }
  | { type: "setExpandedNodes"; nodeIds: Set<string> }
  | { type: "toggleRoom"; roomId: string }
  | { type: "finishClosingRoom"; roomId: string }
  | { type: "openRooms"; roomIds: string[] }
  | { type: "closeAllRooms" }
  | { type: "setZoom"; zoom: number }
  | { type: "zoomBy"; delta: number }
  | { type: "setDive"; dive: DiveState | null }
  | { type: "toggleDebugAreas" }
  | { type: "hoverEdge"; key: string | null };

export const initialCanvasState: CanvasState = {
  scopeId: null,
  selectedNodeId: null,
  peekNodeId: null,
  expandedNodeIds: new Set(),
  expandedScopeIds: new Set(),
  closingScopeIds: new Set(),
  showDebugAreas: false,
  zoom: 1,
  dive: null,
  hoveredEdgeKey: null,
};

function without<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +value.toFixed(2)));
}

export function canvasViewReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "reset":
      return { ...state, scopeId: null, selectedNodeId: null, peekNodeId: null, zoom: 1, dive: null };
    case "enterScope":
      return {
        ...state,
        scopeId: action.scopeId,
        selectedNodeId: action.selectedNodeId,
        peekNodeId: null,
        zoom: 1,
      };
    case "setScope":
      return { ...state, scopeId: action.scopeId };
    case "selectNode":
      return { ...state, selectedNodeId: action.nodeId, peekNodeId: null };
    case "peekNode":
      return { ...state, peekNodeId: action.nodeId };
    case "toggleNode":
      return {
        ...state,
        expandedNodeIds: state.expandedNodeIds.has(action.nodeId)
          ? without(state.expandedNodeIds, action.nodeId)
          : new Set(state.expandedNodeIds).add(action.nodeId),
      };
    case "setExpandedNodes":
      return { ...state, expandedNodeIds: action.nodeIds };
    // Opening cancels a fold in progress, so a Room reopened mid-animation is
    // never counted as both open and closing.
    case "toggleRoom":
      return state.expandedScopeIds.has(action.roomId)
        ? {
            ...state,
            expandedScopeIds: without(state.expandedScopeIds, action.roomId),
            closingScopeIds: new Set(state.closingScopeIds).add(action.roomId),
          }
        : {
            ...state,
            expandedScopeIds: new Set(state.expandedScopeIds).add(action.roomId),
            closingScopeIds: without(state.closingScopeIds, action.roomId),
          };
    case "finishClosingRoom":
      return { ...state, closingScopeIds: without(state.closingScopeIds, action.roomId) };
    case "openRooms":
      return { ...state, expandedScopeIds: new Set(action.roomIds), closingScopeIds: new Set() };
    case "closeAllRooms":
      return {
        ...state,
        expandedScopeIds: new Set(),
        closingScopeIds: new Set([...state.closingScopeIds, ...state.expandedScopeIds]),
      };
    case "setZoom":
      return { ...state, zoom: clampZoom(action.zoom) };
    case "zoomBy":
      return { ...state, zoom: clampZoom(state.zoom + action.delta) };
    case "setDive":
      return { ...state, dive: action.dive };
    case "toggleDebugAreas":
      return { ...state, showDebugAreas: !state.showDebugAreas };
    case "hoverEdge":
      return { ...state, hoveredEdgeKey: action.key };
    default:
      return state;
  }
}

export type CanvasView = CanvasState & {
  /** Open plus still-folding Rooms — what the canvas actually has to draw. */
  renderedExpandedScopeIds: Set<string>;
  reset: () => void;
  enterScope: (scopeId: string | null, selectedNodeId?: string | null) => void;
  /** Moves the scope without disturbing selection or zoom. */
  setScope: (scopeId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  peekNode: (nodeId: string | null) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  expandNodes: (nodeIds: string[]) => void;
  collapseNodes: () => void;
  toggleScopeExpand: (roomId: string) => void;
  expandRooms: (roomIds: string[]) => void;
  collapseRooms: () => void;
  setZoom: (zoom: number) => void;
  zoomBy: (delta: number) => void;
  toggleDebugAreas: () => void;
  hoverEdge: (key: string | null) => void;
  /** Runs the fold animation, committing the scope change between its two halves. */
  diveTo: (scale: number, x: number, y: number, commit: () => void) => void;
};

export function useCanvasView(): CanvasView {
  const [state, dispatch] = useReducer(canvasViewReducer, initialCanvasState);
  const diveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const foldTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const { closingScopeIds } = state;

  // A Room stays in closingScopeIds only for the length of its fold. Driving the
  // timers from the rendered set — rather than from each action — means one rule
  // covers folding a single Room, folding all of them, and reopening mid-fold.
  useEffect(() => {
    const timers = foldTimers.current;
    for (const roomId of closingScopeIds) {
      if (timers.has(roomId)) continue;
      timers.set(
        roomId,
        setTimeout(() => {
          timers.delete(roomId);
          dispatch({ type: "finishClosingRoom", roomId });
        }, ROOM_TRANSITION_MS)
      );
    }
    for (const [roomId, timer] of timers) {
      if (closingScopeIds.has(roomId)) continue;
      clearTimeout(timer);
      timers.delete(roomId);
    }
  }, [closingScopeIds]);

  useEffect(() => {
    const timers = foldTimers.current;
    return () => {
      clearDive(diveTimers);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const diveTo = useCallback((scale: number, x: number, y: number, commit: () => void) => {
    clearDive(diveTimers);
    if (prefersReducedMotion()) {
      dispatch({ type: "setDive", dive: null });
      commit();
      return;
    }
    dispatch({ type: "setDive", dive: { phase: "exit", scale, x, y } });
    diveTimers.current.push(
      setTimeout(() => {
        commit();
        dispatch({ type: "setDive", dive: { phase: "enter", scale, x, y } });
        diveTimers.current.push(
          setTimeout(() => dispatch({ type: "setDive", dive: null }), DIVE_MS + 40)
        );
      }, DIVE_MS)
    );
  }, []);

  const renderedExpandedScopeIds = useMemo(
    () => new Set([...state.expandedScopeIds, ...state.closingScopeIds]),
    [state.expandedScopeIds, state.closingScopeIds]
  );

  return {
    ...state,
    renderedExpandedScopeIds,
    reset: useCallback(() => {
      clearDive(diveTimers);
      dispatch({ type: "reset" });
    }, []),
    enterScope: useCallback(
      (scopeId: string | null, selectedNodeId: string | null = null) =>
        dispatch({ type: "enterScope", scopeId, selectedNodeId }),
      []
    ),
    setScope: useCallback((scopeId: string | null) => dispatch({ type: "setScope", scopeId }), []),
    selectNode: useCallback((nodeId: string | null) => dispatch({ type: "selectNode", nodeId }), []),
    peekNode: useCallback((nodeId: string | null) => dispatch({ type: "peekNode", nodeId }), []),
    toggleNodeExpansion: useCallback((nodeId: string) => dispatch({ type: "toggleNode", nodeId }), []),
    expandNodes: useCallback(
      (nodeIds: string[]) => dispatch({ type: "setExpandedNodes", nodeIds: new Set(nodeIds) }),
      []
    ),
    collapseNodes: useCallback(() => dispatch({ type: "setExpandedNodes", nodeIds: new Set() }), []),
    toggleScopeExpand: useCallback((roomId: string) => dispatch({ type: "toggleRoom", roomId }), []),
    expandRooms: useCallback((roomIds: string[]) => dispatch({ type: "openRooms", roomIds }), []),
    collapseRooms: useCallback(() => dispatch({ type: "closeAllRooms" }), []),
    setZoom: useCallback((zoom: number) => dispatch({ type: "setZoom", zoom }), []),
    zoomBy: useCallback((delta: number) => dispatch({ type: "zoomBy", delta }), []),
    toggleDebugAreas: useCallback(() => dispatch({ type: "toggleDebugAreas" }), []),
    hoverEdge: useCallback((key: string | null) => dispatch({ type: "hoverEdge", key }), []),
    diveTo,
  };
}
