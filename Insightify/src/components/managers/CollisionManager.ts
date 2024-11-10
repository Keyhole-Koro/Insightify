import { useEffect, useState } from "react";
import React from "react";
import { BaseItemClass } from "@base/base/base-item";
import { angle, Point, sigmoid, magnitude } from "@utils/math";

export const useCollisionManager = () => {
    let ancestorComponent: BaseItemClass[] = [];
    
    const collidingItem = (point: Point): BaseItemClass | undefined => {
        const findCollidingChild = (parent: BaseItemClass): BaseItemClass | undefined => {
            return parent.state.item_childs.find((child) => checkCollision(point, child)) 
                ?? parent.state.item_childs.reduce<BaseItemClass | undefined>((result, child) => {
                    return result ?? findCollidingChild(child);
                }, undefined);
        };

        return ancestorComponent.find(component => checkCollision(point, component)) 
            ?? ancestorComponent.reduce<BaseItemClass | undefined>((result, component) => {
                return result ?? findCollidingChild(component);
            }, undefined);
    };


    const collisionDetPoint = (item: BaseItemClass, startPoint: Point): Point => {
        const currentPoint = {
            x: item.state.x,
            y: item.state.y
        }

        const center: Point = {
          x: item.state.x + item.collision_width / 2,
          y: item.state.y + item.collision_height / 2,
        }
        
        const offset = calculateCollisionOffset(item, startPoint, currentPoint);
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

    const calculateCollisionOffset = (item: BaseItemClass, startCoordi: Point, curCoordi: Point): Point => {
      const maxOffset = (angleDeg: number, width: number, height: number) => {
        if (angleDeg >= 337.5 || angleDeg < 22.5) {
          return { x: - width / 2, y: 0 }; // CenterLeft
        } else if (angleDeg < 67.5) {
          return { x: - width / 2, y: - height / 2 }; // TopLeft
        } else if (angleDeg < 112.5) {
          return { x: 0, y: - height / 2 }; // TopCenter
        } else if (angleDeg < 157.5) {
          return { x: width / 2, y: - height / 2 }; // TopRight
        } else if (angleDeg < 202.5) {
          return { x: width / 2, y: 0 }; // CenterRight
        } else if (angleDeg < 247.5) {
          return { x: width / 2, y: height / 2 }; // BottomRight
        } else if (angleDeg < 292.5) {
          return { x: 0, y: height / 2 }; // BottomCenter
        } else {
          return { x: - width / 2, y: height / 2 }; // BottomLeft
        }
      }

      const deltaX = curCoordi.x - startCoordi.y;
      const deltaY = curCoordi.y - startCoordi.y
    
      const angleDeg = angle(deltaX, deltaY);

      const height = item.collision_height;
      const width = item.collision_width;

      const offset = maxOffset(angleDeg, width, height);

      const index = sigmoid(Math.log(magnitude(deltaX, deltaY)) - 5);

      console.log(Math.log(magnitude(deltaX, deltaY)) - 5, index)

      const offset_: Point = {
        x: offset.x * index,
        y: offset.y * index
      };

      return offset_;
    };

    return {
        collidingItem,
        collisionDetPoint
    }
};