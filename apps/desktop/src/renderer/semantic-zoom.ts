// Semantic Zoom changes which abstraction level a Portal presents, not how big
// the card is. The level follows the projected width of a Portal, so zooming
// out replaces detail with structure instead of shrinking unreadable text.
import {
  MAX_ROOM_FRAME_TOTAL_SHARE,
  MAX_STAGE_SCALE,
  PORTAL_CARD_HEIGHT,
  PORTAL_CARD_WIDTH,
  roomFramePixelSize,
  stagePixelsForRoom,
  type RoomGridShape,
} from "@insightify/graph-domain";

// The level decides how large a card is, and size is a layout concern, so the
// definition lives with the other measurements rather than here.
export type { SemanticLevel } from "@insightify/graph-domain";
import type { SemanticLevel } from "@insightify/graph-domain";

export { PORTAL_CARD_WIDTH, PORTAL_CARD_HEIGHT };
export const SEMANTIC_THRESHOLDS = { flow: 112, implementation: 230 } as const;
// Interaction spec 9.3: a 12% band keeps the level from flipping every frame
// while the user hovers on a threshold.
const HYSTERESIS = 0.12;

export function nextSemanticLevel(current: SemanticLevel, projectedWidth: number): SemanticLevel {
  const dropsBelow = (threshold: number) => projectedWidth < threshold * (1 - HYSTERESIS);
  if (projectedWidth >= SEMANTIC_THRESHOLDS.implementation) return "implementation";
  if (current === "implementation" && !dropsBelow(SEMANTIC_THRESHOLDS.implementation)) return "implementation";
  if (projectedWidth >= SEMANTIC_THRESHOLDS.flow) return "flow";
  if (current !== "structure" && !dropsBelow(SEMANTIC_THRESHOLDS.flow)) return "flow";
  return "structure";
}

export function semanticLevelForZoom(current: SemanticLevel, zoom: number): SemanticLevel {
  return nextSemanticLevel(current, PORTAL_CARD_WIDTH * zoom);
}

// A Room is laid out at its natural pitch and then fitted into the frame, so a
// dense Room reads at a lower semantic level instead of overlapping itself.
export const COLUMN_PITCH = PORTAL_CARD_WIDTH + 20;
export const ROW_PITCH = PORTAL_CARD_HEIGHT;

export type StageMetrics = { width: number; height: number; scale: number };
type StageNode = { x: number; y: number; width?: number; height?: number };
// Only the parts of a Room frame the stage has to be big enough for.
type StageFrame = RoomGridShape;

// layoutFlowNodes keeps the outermost column at 15% of the stage, so the stage
// must be wide enough for half a card to fit inside that margin.
const MINIMUM_STAGE_WIDTH = PORTAL_CARD_WIDTH / 0.3;

/**
 * How much a stage of this size has to be shrunk, or may be grown, to sit in
 * the canvas. A Room that needs less space than the canvas is shown larger, so
 * a short flow gains detail instead of leaving the canvas empty.
 */
export function stageScale(
  stage: { width: number; height: number },
  frame: { width: number; height: number }
): number {
  const inner = { width: Math.max(320, frame.width - 96), height: Math.max(240, frame.height - 96) };
  return Math.min(MAX_STAGE_SCALE, Math.max(0.3, Math.min(inner.width / stage.width, inner.height / stage.height)));
}

export function stageMetrics(
  nodes: StageNode[],
  frame: { width: number; height: number },
  roomFrames: StageFrame[] = []
): StageMetrics {
  const inner = { width: Math.max(320, frame.width - 96), height: Math.max(240, frame.height - 96) };
  if (nodes.length === 0 && roomFrames.length === 0) {
    return { width: inner.width, height: inner.height, scale: 1 };
  }
  // Count only nodes that actually share a visual row/column. Counting every
  // distinct percentage as a new row made staggered two-lane Rooms several
  // screens tall even though each lane contained only a few compact cards.
  let width = MINIMUM_STAGE_WIDTH;
  let height = ROW_PITCH * 2;
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex]!;
      const right = nodes[rightIndex]!;
      const deltaX = Math.abs(right.x - left.x);
      const deltaY = Math.abs(right.y - left.y);
      if (deltaY <= 4.5 && deltaX > 0.1) {
        const pitch =
          (left.width ?? PORTAL_CARD_WIDTH) / 2 +
          (right.width ?? PORTAL_CARD_WIDTH) / 2 +
          8;
        width = Math.max(width, (pitch * 100) / deltaX);
      }
      if (deltaX <= 4.5 && deltaY > 0.1) {
        const pitch = (left.height ?? ROW_PITCH) / 2 + (right.height ?? ROW_PITCH) / 2 + 6;
        height = Math.max(height, (pitch * 100) / deltaY);
      }
    }
  }
  // An unfolded Room needs a fixed number of pixels for the cards it holds, and
  // may occupy at most a fixed share of the stage. Those two facts give the
  // stage size directly. The frame is then sized against that stage, so the
  // frame and its contents are derived from one number instead of two that
  // could disagree — which is what used to let cards spill out of their frame.
  let roomsWide = 0;
  for (const room of roomFrames) {
    const required = stagePixelsForRoom(room.columns, room.rows);
    width = Math.max(width, required.width);
    height = Math.max(height, required.height);
    roomsWide += roomFramePixelSize(room.columns, room.rows).width;
  }
  // Side by side, they all have to fit at once.
  if (roomFrames.length > 1) {
    width = Math.max(width, roomsWide / MAX_ROOM_FRAME_TOTAL_SHARE);
  }

  return { width, height, scale: stageScale({ width, height }, frame) };
}
