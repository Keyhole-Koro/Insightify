import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { ExpandedRoomFrame, GeneratedFlowGraph } from "@insightify/graph-domain";
import { placeNode } from "../lib/graph-edits.js";
import { pointerToStage, resolveDragPosition } from "../lib/drag-position.js";
import type { GraphUpdate } from "./useProjectGraph.js";

type DragState = { nodeId: string; pointerId: number; moved: boolean };

type NodeDragOptions = {
  disabled: boolean;
  canvasRef: RefObject<HTMLElement | null>;
  stage: { width: number; height: number };
  stageZoom: number;
  roomFrames: ExpandedRoomFrame[];
  currentGraph: () => GeneratedFlowGraph | null;
  previewEdit: (update: GraphUpdate) => void;
  commitPreview: () => void;
  onSelect: (nodeId: string) => void;
};

export type NodeDragHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, nodeId: string) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** True once per drag, so the click that ends a drag does not also open the node. */
  consumeClickSuppression: (nodeId: string) => boolean;
};

export function useNodeDrag(options: NodeDragOptions): NodeDragHandlers {
  const {
    disabled,
    canvasRef,
    stage,
    stageZoom,
    roomFrames,
    currentGraph,
    previewEdit,
    commitPreview,
    onSelect,
  } = options;
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, nodeId: string) => {
      if (event.button !== 0 || disabled || (event.target as HTMLElement).closest("button")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { nodeId, pointerId: event.pointerId, moved: false };
      onSelect(nodeId);
    },
    [disabled, onSelect]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
      const point = pointerToStage(event, canvas.getBoundingClientRect(), stage, stageZoom);
      const dragged = currentGraph()?.graph.nodes.find((node) => node.id === drag.nodeId);
      const position = resolveDragPosition(point, {
        parent: dragged?.parentId
          ? roomFrames.find((frame) => frame.roomId === dragged.parentId)
          : undefined,
        own: roomFrames.find((frame) => frame.roomId === drag.nodeId),
      });
      drag.moved = true;
      previewEdit((current) => placeNode(current, drag.nodeId, position));
    },
    [canvasRef, currentGraph, previewEdit, roomFrames, stage, stageZoom]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!drag.moved) return;
      suppressClickRef.current = drag.nodeId;
      setTimeout(() => {
        if (suppressClickRef.current === drag.nodeId) suppressClickRef.current = null;
      }, 0);
      commitPreview();
    },
    [commitPreview]
  );

  const consumeClickSuppression = useCallback((nodeId: string) => {
    if (suppressClickRef.current !== nodeId) return false;
    suppressClickRef.current = null;
    return true;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, consumeClickSuppression };
}
