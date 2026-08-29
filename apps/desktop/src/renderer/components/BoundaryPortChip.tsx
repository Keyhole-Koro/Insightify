import React from "react";
import type { ScopeBoundaryPort } from "@insightify/graph-domain";
import type { SemanticLevel } from "../semantic-zoom.js";

interface BoundaryPortChipProps {
  port: ScopeBoundaryPort;
  lod: SemanticLevel;
  left: number;
  top: number;
}

// A Room is a window on a larger flow, not a sealed box: edges that cross the
// wall stay visible as a named port on the boundary.
export function BoundaryPortChip({ port, lod, left, top }: BoundaryPortChipProps) {
  const names = port.endpoints.map((endpoint) => endpoint.title).join(", ");

  return (
    <div
      className={`boundary-port ${port.side}`}
      style={{ left: `${left}%`, top: `${top}%` }}
      title={`${port.side === "input" ? "From" : "To"} ${names}`}
    >
      <i />
      {lod !== "structure" && (
        <span>
          {port.side === "input" ? "◀" : "▶"} {names}
        </span>
      )}
      {port.count > 1 && <b>{port.count}</b>}
    </div>
  );
}
