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
/**
 * The tallest a collapsed card gets. It used to be 92: the icon stood above the
 * pill and the two together were most of it. The icon leads the card now, so
 * the card is one row.
 */
export const PORTAL_CARD_HEIGHT = 38;

/** The plate that opens below a card, and the gap between the two. */
export const PORTAL_PLATE_WIDTH = 240;
export const PORTAL_PLATE_GAP = 6;
/**
 * Measured, not guessed. The plate shows a summary and nothing else, so it is
 * one height rather than one per zoom level — which also means how large a node
 * is no longer depends on the level it is drawn at, and the level is free to be
 * decided last, from the stage that placement produced.
 *
 * `visual:qa` warns when a card is painted larger than the size declared here,
 * so a change to the plate's contents cannot silently invalidate the layout.
 */
export const PORTAL_PLATE_HEIGHT = 112;

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
  const plate = PORTAL_PLATE_GAP + PORTAL_PLATE_HEIGHT;
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

/**
 * An edge label is a box too, and it has to be kept off the cards the same way
 * a card is kept off another card. Its width is estimated from its text rather
 * than measured: the layout is a pure function with no DOM to ask, and an
 * estimate that runs a little wide only spreads labels slightly further apart.
 * `visual:qa` reports a label painted wider than this.
 */
// A label is drawn outside the stage transform, at a fixed size on screen. Its
// size in stage units therefore depends on the zoom — the same label covers
// twice as much of the arrangement at half the magnification — so the caller
// passes the zoom in. Measured on the fixture: 4.2px per character plus 14px of
// padding, 16px tall, capped by the 130px max-width it is drawn with.
const EDGE_LABEL_CHARACTER_WIDTH = 4.2;
const EDGE_LABEL_PADDING = 14;
const EDGE_LABEL_MAX_WIDTH = 144;
export const EDGE_LABEL_SCREEN_HEIGHT = 16;

export function edgeLabelExtent(text: string, stageZoom = 1): NodeExtent {
  const zoom = stageZoom > 0 ? stageZoom : 1;
  return {
    width:
      Math.min(EDGE_LABEL_MAX_WIDTH, text.length * EDGE_LABEL_CHARACTER_WIDTH + EDGE_LABEL_PADDING)
      / zoom,
    height: EDGE_LABEL_SCREEN_HEIGHT / zoom,
    offsetY: 0,
  };
}

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
