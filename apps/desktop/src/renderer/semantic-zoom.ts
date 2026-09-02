// Semantic Zoom changes which abstraction level a Portal presents, not how big
// the card is. The level follows the projected width of a Portal, so zooming
// out replaces detail with structure instead of shrinking unreadable text.
export type SemanticLevel = "structure" | "flow" | "implementation";

export const PORTAL_CARD_WIDTH = 190;
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
export const ROW_PITCH = 82;

export type StageMetrics = { width: number; height: number; scale: number };
type StageNode = { x: number; y: number; width?: number; height?: number };
// Only the parts of a Room frame the stage has to be big enough for.
type StageFrame = {
  bounds: { width: number; height: number };
  columns: number;
  rows: number;
};

// A compact pill inside an unfolded Room, and the gap it needs from the next.
// The pill carries its icon inline rather than stacked above it, which is what
// keeps the vertical pitch near the height of a single row of text.
export const NESTED_PITCH_X = 162;
export const NESTED_PITCH_Y = 40;

// layoutFlowNodes keeps the outermost column at 15% of the stage, so the stage
// must be wide enough for half a card to fit inside that margin.
const MINIMUM_STAGE_WIDTH = PORTAL_CARD_WIDTH / 0.3;

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
  // An unfolded Room is sized as a share of the stage, so the stage has to be
  // large enough for that share to hold the pills inside it. Measuring the
  // frame rather than its children keeps their deliberately tight pitch from
  // being read as the gap between two ordinary cards, which would demand a
  // stage several screens tall and shrink everything else to pay for it.
  for (const room of roomFrames) {
    if (room.bounds.width > 0) {
      width = Math.max(width, (room.columns * NESTED_PITCH_X * 100) / room.bounds.width);
    }
    if (room.bounds.height > 0) {
      height = Math.max(height, (room.rows * NESTED_PITCH_Y * 100) / room.bounds.height);
    }
  }

  // A Room that needs less space than the frame is shown larger, so a short
  // flow gains detail instead of leaving the canvas empty.
  const scale = Math.min(1.35, Math.max(0.3, Math.min(inner.width / width, inner.height / height)));
  return { width, height, scale };
}
