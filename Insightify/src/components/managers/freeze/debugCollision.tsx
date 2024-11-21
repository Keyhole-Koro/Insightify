import { useState } from "react";
import { Point } from "@utils/math";

export const CollisionDebug: React.FC<{point?: Point, color: string}> = ({point, color}) => {
    return (
      <svg>
        <circle cx={point?.x} cy={point?.y} r="5" fill={color} />
      </svg>
    );
  }