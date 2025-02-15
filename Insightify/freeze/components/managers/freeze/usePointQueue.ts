import { useState } from "react";
import { Point } from "@utils/math";

const usePointQueue = (queueLength: number) => {
  const [pointQueue, setPointQueue] = useState<Point[]>([]);

  const addPoint = (point: Point) => {
    setPointQueue(prevQueue => {
      const newQueue = [...prevQueue, point];
      if (newQueue.length > queueLength) {
        newQueue.shift();
      }
      return newQueue;
    });
  };

  const getPastPoint = (): Point | undefined => {
    return pointQueue[0];
  };

  return {
    addPoint,
    getPastPoint,
  };
};

export default usePointQueue;