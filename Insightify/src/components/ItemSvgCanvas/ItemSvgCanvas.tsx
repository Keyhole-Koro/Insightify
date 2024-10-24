import React, { useState } from 'react';
import ItemManager from '../managers/ItemManager';
import { BaseItemClass } from '@components/item/base/base-item';

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

    const collidingItem = itemManager.getCollidingItem(draggedItem);

    if (!collidingItem) return null;

      itemManager.bringChildItemAboveParentBelow(draggedItem, collidingItem);
    
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
      const collidingItem = itemManager.getCollidingItem(draggedItem);
    if (collidingItem) {
        draggedItem.beChildOf(collidingItem);
        itemManager.bringChildItemAboveParentBelow(draggedItem, collidingItem);
    } else if (draggedItem.parent) {
        draggedItem.stopBeingChildOf(draggedItem.parent);
      }
    }

    setDraggedItem(null);
  };

  return (
    <svg
      width={width}
      height={height}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {itemManager.renderAll().map((element, index) =>
        React.cloneElement(element, {
          key: index,
          onMouseDown: (e: React.MouseEvent) => handleMouseDown(itemManager.getItemByIndex(index), e),
        })
      )}
    </svg>
  );
};

export default ItemSvgCanvas;