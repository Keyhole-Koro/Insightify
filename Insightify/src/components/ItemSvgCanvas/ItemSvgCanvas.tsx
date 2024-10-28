export {}
/*
import React, { useState } from 'react';
import ItemManager from '../managers/ItemManager';
import { BaseItemClass } from '@base/base/base-item';

export const ItemSvgCanvas: React.FC<{ itemManager: ItemManager; height: number; width: number }> = ({
  itemManager,
  height,
  width,
}) => {
  const [draggedItem, setDraggedItem] = useState<BaseItemClass | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [update, setUpdate] = useState<boolean>(false);

  const handleCollision = () => {
    if (!draggedItem) return null;

    const collidingItem = itemManager.getCollidingItems(draggedItem);

    if (!collidingItem) return null;

    itemManager.bringChildItemAboveParentBelow(draggedItem, collidingItem[0]);
    
    return collidingItem;
  };

  const handleMouseDown = (item: BaseItemClass, event: React.MouseEvent) => {
    setDraggedItem(item);

    // Calculate the offset between the mouse position and the item's position
    const offsetX = event.clientX - item.x;
    const offsetY = event.clientY - item.y;
    setOffset({ x: offsetX, y: offsetY });

    handleCollision();

    event.stopPropagation();
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggedItem) {
      // Update the item's position based on the initial offset
      draggedItem.setPosition(
        event.clientX - offset.x,
        event.clientY - offset.y
      );

      handleCollision();

      // Trigger a re-render
      setUpdate(update ? false : true);
    }
  };

  const handleMouseUp = () => {    
    if (draggedItem) {
      const collidingItems = itemManager.getCollidingItems(draggedItem);
      
      const parentCollidingItems = collidingItems.filter(
        (item) => !isChildOf(draggedItem, item)
      );
  
      if (parentCollidingItems.length > 0) {
        const collidingItem = parentCollidingItems[0];
        draggedItem.beChildOf(collidingItem);
        itemManager.bringChildItemAboveParentBelow(draggedItem, collidingItem);
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
    <svg
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <ItemManager />
    </svg>
  );
};

export default ItemSvgCanvas;
*/