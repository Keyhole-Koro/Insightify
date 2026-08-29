import type { ExpandedRoomFrame, FlowNodePosition } from "@insightify/graph-domain";

// Where a dragged node is allowed to land. Three cases, because the canvas has
// three coordinate systems: a node inside an unfolded Room is stored in that
// Room's local 0–100 space, a Room frame is stored by its centre but must keep
// its whole box on screen, and everything else is a plain stage percentage.
export function resolveDragPosition(
  point: FlowNodePosition,
  frames: { parent?: ExpandedRoomFrame; own?: ExpandedRoomFrame }
): FlowNodePosition {
  if (frames.parent) {
    const { contentBounds } = frames.parent;
    return {
      x: clamp(((point.x - contentBounds.x) / contentBounds.width) * 100, 4, 96),
      y: clamp(((point.y - contentBounds.y) / contentBounds.height) * 100, 4, 96),
    };
  }
  if (frames.own) {
    const { bounds } = frames.own;
    return {
      x: clamp(point.x, 1 + bounds.width / 2, 99 - bounds.width / 2),
      y: clamp(point.y, 3 + bounds.height / 2, 97 - bounds.height / 2),
    };
  }
  return { x: clamp(point.x, 8, 92), y: clamp(point.y, 15, 87) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Converts a pointer position into the stage's percentage space. */
export function pointerToStage(
  event: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
  stage: { width: number; height: number },
  stageZoom: number
): FlowNodePosition {
  return {
    x: 50 + ((event.clientX - rect.left - rect.width / 2) / stageZoom / stage.width) * 100,
    y: 50 + ((event.clientY - rect.top - rect.height / 2) / stageZoom / stage.height) * 100,
  };
}
