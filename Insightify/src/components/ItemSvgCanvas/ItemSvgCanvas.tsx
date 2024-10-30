import React, { useEffect, useState } from 'react';
import { useItemManager } from '../managers/ItemManager';
import { BaseItemClass } from '@base/base/base-item';

export const ItemSvgCanvas: React.FC<{ height: number; width: number }> = ({
  height,
  width,
}) => {
  const [draggedItem, setDraggedItem] = useState<BaseItemClass | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const {
    renderItems,
    itemButtons,
    checkCollision,
    getCollidingItems,
    bringChildItemAboveParentBelow
  } = useItemManager();

  const handleCollision = () => {
    if (!draggedItem) return null;

    const collidingItem = getCollidingItems(draggedItem);

    if (!collidingItem) return null;

    bringChildItemAboveParentBelow(draggedItem, collidingItem[0]);
    
    return collidingItem;
  };

  const handleMouseDown = (item: BaseItemClass, event: React.MouseEvent) => {
    console.log('handleMouseDown');
    setDraggedItem(item);

    // Calculate the offset between the mouse position and the item's position
    const offsetX = event.clientX - item.state.x;
    const offsetY = event.clientY - item.state.y;
    setOffset({ x: offsetX, y: offsetY });

    handleCollision();

  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggedItem) {
      // Update the item's position based on the initial offset
      draggedItem.setPosition(
        event.clientX - offset.x,
        event.clientY - offset.y
      );

      handleCollision();

    }
  };

  const handleMouseUp = () => {
    if (draggedItem) {
      const collidingItems = getCollidingItems(draggedItem);
      
      const parentCollidingItems = collidingItems.filter(
        (item) => !isChildOf(draggedItem, item)
      );
  
      if (parentCollidingItems.length > 0) {
        const collidingItem = parentCollidingItems[0];
        draggedItem.beChildOf(collidingItem);
        bringChildItemAboveParentBelow(draggedItem, collidingItem);
      } else if (draggedItem.state.item_parent) {
        draggedItem.stopBeingChildOf(draggedItem.state.item_parent);
      }
  
      setDraggedItem(null);
    }
  };
  
  const isChildOf = (parent: BaseItemClass, child: BaseItemClass): boolean => {
    if (child.state.item_parent === parent) return true;
    if (!child.state.item_parent) return false;
    return isChildOf(parent, child.state.item_parent);
  };

  return (
    <div>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {renderItems(
          {
          })}
      </svg>
      {itemButtons()}
    </div>
  );
};

export default ItemSvgCanvas;