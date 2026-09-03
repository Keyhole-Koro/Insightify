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

/**
 * Which abstraction level a Portal presents. It belongs here because the level
 * decides how large a node is, and how large a node is decides the layout.
 */
export type SemanticLevel = "structure" | "flow" | "implementation";

/** The card drawn for a node in its own scope, in every state it can be in. */
export const PORTAL_CARD_WIDTH = 190;
/** The tallest a collapsed card gets: avatar, gap, pill. */
export const PORTAL_CARD_HEIGHT = 92;

/** The plate that opens below a card, and the gap between the two. */
export const PORTAL_PLATE_WIDTH = 240;
export const PORTAL_PLATE_GAP = 6;
/**
 * Measured, not guessed: the plate carries a code block, a child miniature and
 * its evidence only at the implementation level, which is most of its height.
 * `visual:qa` warns when a card is painted larger than the size declared here,
 * so a change to the plate's contents cannot silently invalidate the layout.
 */
export const PORTAL_PLATE_HEIGHT: Record<SemanticLevel, number> = {
  structure: 112,
  flow: 112,
  implementation: 210,
};

/**
 * An open plate always reserves the tallest it could be, not the height it
 * happens to have right now.
 *
 * The level a card is drawn at follows how large the stage ends up, the stage
 * follows where everything was placed, and placement follows how much room each
 * node needs — so letting the level decide that last figure closes the loop.
 * Reserving the maximum breaks it. The cost is bounded: while a plate is open
 * below the implementation level, its neighbours are pushed about a hundred
 * pixels further than strictly necessary. Under-reserving costs an overlap.
 */
const RESERVED_PLATE_HEIGHT = Math.max(...Object.values(PORTAL_PLATE_HEIGHT));

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

/**
 * How much larger than its own size a stage may be drawn. The stage is fitted
 * to its contents, so without a ceiling a two-node graph would fill the canvas
 * with two enormous cards.
 */
export const MAX_STAGE_SCALE = 1.8;

/**
 * How much room a node occupies, in pixels, and where that room sits relative to
 * the node's coordinate. The coordinate is the centre of the *card*, and the
 * plate opens below it, so an expanded node's box is not centred on its own
 * position — `offsetY` is how far down the middle of the box actually is.
 */
export type NodeExtent = { width: number; height: number; offsetY: number };

/**
 * The one answer to "how big is this node". Everything that has to avoid a node
 * — the stage, the reflow that keeps siblings apart, the frame of an unfolded
 * Room — asks here, so none of them can be working from a different figure.
 */
export function nodeExtent(state: { nested?: boolean; expanded?: boolean }): NodeExtent {
  if (state.nested) {
    return { width: NESTED_CARD_WIDTH, height: NESTED_CARD_HEIGHT, offsetY: 0 };
  }
  if (!state.expanded) {
    return { width: PORTAL_CARD_WIDTH, height: PORTAL_CARD_HEIGHT, offsetY: 0 };
  }
  const plate = PORTAL_PLATE_GAP + RESERVED_PLATE_HEIGHT;
  return {
    width: PORTAL_PLATE_WIDTH,
    height: PORTAL_CARD_HEIGHT + plate,
    // The card keeps its place and the plate is added underneath, so the box
    // reaches half the plate further down than the coordinate it belongs to.
    offsetY: plate / 2,
  };
}

export type RoomFrameMetrics = {
  stageWidth: number;
  stageHeight: number;
};

/** The stage, plus the view state that changes how large a node is. */
export type LayoutView = RoomFrameMetrics & {
  expandedNodeIds?: Set<string>;
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
