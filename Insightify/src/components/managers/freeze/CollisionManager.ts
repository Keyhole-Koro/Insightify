import { useEffect, useState } from "react";
import React from "react";
import { BaseItemClass } from "@base/base/base-item";
import { angle, Point, sigmoid, magnitude } from "@utils/math";
import { useItemManager } from "../ItemManager";

export const useCollisionManager = () => {
  const [fieldComponent, setFieldComponent] = useState<BaseItemClass[]>([]);
  const [event, setEvent] = useState<MouseEvent | null>(null);
  const [trackingItem, setTrackingItem] = useState<BaseItemClass | null>(null);
  const [collidingDetPoint, setCollisionDetPoint] = useState<Point>({ x: 0, y: 0 });

  const approachSpeed = 0.5; // Adjust for faster or slower approach

  useEffect(() => {
    let animationFrameId: number;
    const pointQueue: Point[] = [];
    const queueLength = 5; // Number of frames to look back

    const animateApproach = () => {
      setCollisionDetPoint(prevPoint => {
        if (!trackingItem) return prevPoint;

        const center: Point = {
          x: trackingItem.state.x + trackingItem.collision_width / 2,
          y: trackingItem.state.y + trackingItem.collision_height / 2,
        };

        console.log(magnitude(prevPoint.x - center.x, prevPoint.y - center.y))
        if (magnitude(prevPoint.x - center.x, prevPoint.y - center.y) < 20) {
          return prevPoint;
        }

        const pastPoint = pointQueue[0] || prevPoint;

        pointQueue.push(prevPoint);

        // Ensure the queue does not exceed the desired length
        if (pointQueue.length > queueLength) {
          pointQueue.shift();
        }

        const { x, y } = collisionDetPoint(center, trackingItem.collision_width, trackingItem.collision_height, pastPoint, approachSpeed);

        return {
          x: x,
          y: y,
        };
      });

      animationFrameId = requestAnimationFrame(animateApproach);
    };

    if (trackingItem) {
      // Start animation
      animateApproach();
    }

    // Clean up on component unmount or when trackingItem changes
    return () => cancelAnimationFrame(animationFrameId);

  }, [trackingItem]);

  const addFieldComponent = (item: BaseItemClass): void => {
    fieldComponent.push(item);
  };

  const detectCollidingItem = (point: Point): BaseItemClass | undefined => {
    const findCollidingChild = (parent: BaseItemClass): BaseItemClass | undefined => {
      return parent.state.item_childs.find((child) => checkCollision(point, child))
        ?? parent.state.item_childs.reduce<BaseItemClass | undefined>((result, child) => {
          return result ?? findCollidingChild(child);
        }, undefined);
    };

    return fieldComponent.find(component => checkCollision(point, component))
      ?? fieldComponent.reduce<BaseItemClass | undefined>((result, component) => {
        return result ?? findCollidingChild(component);
      }, undefined);
  };

  const collisionDetPoint = (center: Point, width: number, height: number, startPoint: Point, approachSpeed: number): Point => {

    const offset = calculateCollisionOffset(center, width, height, startPoint);

    return {
      x: center.x + offset.x,
      y: center.y + offset.y
    };
  };

  const checkCollision = (point: Point, item: BaseItemClass): boolean => {
    const { x, y } = item.state;
    return (
      point.x >= x &&
      point.x <= x + item.collision_width &&
      point.y >= y &&
      point.y <= y + item.collision_height
    );
  };

  const calculateCollisionOffset = (center: Point, width: number, height: number, startCoordi: Point): Point => {
    const maxOffset = (dx: number, dy: number, width: number, height: number) => {

      // Calculate angle in radians
      const angleRad = Math.atan2(dy, dx);

      // Calculate rotated offset with rotation matrix
      const offsetX = (width / 2) * Math.cos(angleRad) - (height / 2) * Math.sin(angleRad);
      const offsetY = (height / 2) * Math.sin(angleRad) + (height / 2) * Math.cos(angleRad);

      return { x: offsetX, y: offsetY };
    };

    const deltaX = center.x - startCoordi.x;
    const deltaY = center.y - startCoordi.y;

    const offset = maxOffset(deltaX, deltaY, width, height);

    const mag = magnitude(deltaX, deltaY);

    const factor = sigmoid(Math.log(mag) - 4);

    return {
      x: offset.x * factor,
      y: offset.y * factor
    };
  };

  return {
    collidingDetPoint,
    setTrackingItem,
    addFieldComponent,
    detectCollidingItem,
  };
};