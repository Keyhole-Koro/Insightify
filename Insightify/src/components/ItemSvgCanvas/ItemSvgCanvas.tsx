import React, { useState } from 'react';
import ItemManager from '../managers/ItemManager';
import { BaseItem } from '@item/base-item';

export const ItemSvgCanvas: React.FC<{ itemManager: ItemManager; height: number; width: number }> = ({
  itemManager,
  height,
  width,
}) => {
  const [draggedItem, setDraggedItem] = useState<BaseItem | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [update, setUpdate] = useState<boolean>(false);

  const handleMouseDown = (item: BaseItem, event: React.MouseEvent) => {
    setDraggedItem(item);

    itemManager.bringItemToFront(item);

    const offsetX = event.clientX - item.x;
    const offsetY = event.clientY - item.y;
    setOffset({ x: offsetX, y: offsetY });

    event.stopPropagation();
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggedItem) {
      draggedItem.x = event.clientX - offset.x;
      draggedItem.y = event.clientY - offset.y;
      setUpdate(update ? false : true);
    }
  };

  const handleMouseUp = () => {
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
