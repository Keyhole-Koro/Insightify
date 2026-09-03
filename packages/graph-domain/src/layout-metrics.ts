// Every pixel the layout reasons about, in one place.
//
// Coordinates in this package are percentages, because a Portal's position is
// relative to the scope that holds it. A Room frame is the one thing that has
// to be both: it is positioned as a percentage of the stage, but it has to be
// large enough to hold real cards at a real pitch. Sizing it from a formula
// over percentages meant the frame and the cards inside it were derived from
// different numbers, and the cards spilled out of the frame whenever the two
// disagreed. So the frame is computed in pixels from what it must hold, and
// converted to a percentage of the stage exactly once.

/** The card drawn for a node in its own scope. */
export const PORTAL_CARD_WIDTH = 190;
export const PORTAL_CARD_HEIGHT = 82;

/** The compact pill drawn for a node inside an unfolded Room. */
export const NESTED_CARD_WIDTH = 132;
export const NESTED_CARD_HEIGHT = 26;

/** Centre-to-centre distance between two nested cards. */
export const NESTED_COLUMN_PITCH = NESTED_CARD_WIDTH + 30;
export const NESTED_ROW_PITCH = NESTED_CARD_HEIGHT + 16;

/** The Room's title bar, and the breathing room around its contents. */
export const ROOM_HEADER_HEIGHT = 30;
export const ROOM_FRAME_PADDING = 12;

/**
 * The largest share of the stage one unfolded Room may take. A Room that needs
 * more than this does not grow past it — the stage grows instead, so the Room's
 * neighbours keep their own space rather than being squeezed out by it.
 */
export const MAX_ROOM_FRAME_SHARE = 0.55;

export type RoomFrameMetrics = {
  stageWidth: number;
  stageHeight: number;
};

/**
 * Used when a caller has no stage of its own — tests, and the Portal preview,
 * which draws a miniature rather than the real canvas.
 */
export const DEFAULT_STAGE: RoomFrameMetrics = { stageWidth: 1280, stageHeight: 720 };

/** The pixel size of a Room frame holding `columns` x `rows` compact cards. */
export function roomFramePixelSize(columns: number, rows: number): { width: number; height: number } {
  const centreSpanX = Math.max(0, columns - 1) * NESTED_COLUMN_PITCH;
  const centreSpanY = Math.max(0, rows - 1) * NESTED_ROW_PITCH;
  return {
    width: centreSpanX + NESTED_CARD_WIDTH + ROOM_FRAME_PADDING * 2,
    height: centreSpanY + NESTED_CARD_HEIGHT + ROOM_HEADER_HEIGHT + ROOM_FRAME_PADDING,
  };
}

/**
 * How large the stage must be for a Room of this shape to fit inside its
 * allowed share of it. This is what replaces the old constraint, which asked
 * how many pixels fitted inside a frame whose size was itself a percentage of
 * the answer.
 */
export function stagePixelsForRoom(columns: number, rows: number): { width: number; height: number } {
  const frame = roomFramePixelSize(columns, rows);
  return {
    width: frame.width / MAX_ROOM_FRAME_SHARE,
    height: frame.height / MAX_ROOM_FRAME_SHARE,
  };
}
