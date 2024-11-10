import React, { createRef, useEffect, useState } from 'react';
import { useItemManager } from '@managers/ItemManager';
import { BaseItemClass } from '@base/base/base-item';
import { Point } from '@utils/math';
import { useCollisionManager } from '@managers/CollisionManager';
import { CollisionDebug } from '@managers/debugCollision';

import { DebugLogger } from '@utils/debug';

export const ItemSvgCanvas: React.FC<{ height: number; width: number }> = ({
  height,
  width,
}) => {
  const [draggedItem, setDraggedItem] = useState<BaseItemClass | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [ dragStartPoint, setDragStartPoint ] = useState<Point>({ x: 0, y: 0 });
  let collidingItem_: BaseItemClass;

  
  const [ debugCollisionDetPoint, setDebugCollisionDetPoint ] = useState<Point>();

  const {
    componentItems,
    setComponentItems,
    mountedComponents,
    refs,
    itemButtons,
  } = useItemManager();

  
  const {
    collidingItem,
    collisionDetPoint
  } = useCollisionManager();
   

  useEffect(() => {
    if (!draggedItem) return;
  
    draggedItem.setRelevantGen();
  
  }, [collidingItem, draggedItem]);  

  const handleMouseDown = (id: number) => (event: MouseEvent) => {

    const targetComponent = refs.current[id].current;

    if (!targetComponent) {
      console.warn(`No component found with ID: ${id}`);
      return;
    }

    setDraggedItem(targetComponent);

    // Calculate the offset between the mouse position and the item's position
    const offsetX = event.clientX - targetComponent.state.x;
    const offsetY = event.clientY - targetComponent.state.y;
    setOffset({ x: offsetX, y: offsetY });

    setDragStartPoint({x: targetComponent.state.x, y: targetComponent.state.y})
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggedItem) {
      // Update the item's position based on the initial offset
      draggedItem.setPosition(
        event.clientX - offset.x,
        event.clientY - offset.y
      );

      const collisionPoint = collisionDetPoint(draggedItem, dragStartPoint);

      setDebugCollisionDetPoint(collisionPoint);

      const potentialCollidingItem = collidingItem(
        collisionPoint
      );
      if (potentialCollidingItem) collidingItem_ = potentialCollidingItem;
    }
  };

  const handleMouseUp = () => {
    if (draggedItem) {
      /*
      const collidingItems = getCollidingItems(draggedItem);
      
      const parentCollidingItems = collidingItems.filter(
        (item) => !isChildOf(draggedItem, item)
      );
      
  
      if (parentCollidingItems.length > 0) {
        const collidingItem = parentCollidingItems[0];
        draggedItem.beChildOf(collidingItem);
      } else if (draggedItem.state.item_parent) {
        draggedItem.stopBeingChildOf(draggedItem.state.item_parent);
      }
        */
  
      setDraggedItem(null);
    }
  };
  
  const isChildOf = (parent: BaseItemClass, child: BaseItemClass): boolean => {
    if (child.state.item_parent === parent) return true;
    if (!child.state.item_parent) return false;
    return isChildOf(parent, child.state.item_parent);
  };

const renderItems = () => {
  return componentItems
    .map(({ id, Component, props }) => {
      // Create a ref for each component if it doesn't already exist
      if (!refs.current[id]) {
        refs.current[id] = createRef();
      }
      // Return an object containing the component's id, Component, props, and ref
      return { id, Component, props, ref: refs.current[id] };
    })
    .filter(({ id }) => mountedComponents[id]) // Filter out components that are not mounted
    .sort((a, b) => {
      // Sort components by their layer property
      const layerA = a.ref.current?.state.generation ?? 0;
      const layerB = b.ref.current?.state.generation ?? 0;
      return layerA - layerB;
    })
    .map(({ id, Component, props, ref }) => (
      // Render each component with its props and ref
      <Component
        key={"itemSvgCanvas_" + id}
        id={id}
        ref={ref}
        {...props}
        mouseDownHandler={handleMouseDown(id)}
      />
    ));
};

  return (
    <div>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {renderItems()}
        <CollisionDebug point={dragStartPoint} color="blue"/>
        <CollisionDebug point={debugCollisionDetPoint} color="red"/>
      </svg>
      {itemButtons()}
    </div>
  );
};

export default ItemSvgCanvas;