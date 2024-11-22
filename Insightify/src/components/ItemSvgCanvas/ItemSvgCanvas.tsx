import React, { createRef, useEffect, useState, useRef } from 'react';
import { ItemComponent, useItemManager } from '@managers/ItemManager';
import { BaseItemClass } from '@base/base/base-item';
import { Point } from '@utils/math';
import { Colors } from '@utils/color';
import { Rectangle, RectangleProps, Circle, TextInput, CircleProps } from '@llitems/items';
import { TextAlignment } from '@utils/alignment';
import { useItemJSONManager } from '@managers/ItemJsonManager';
import { ItemJSON } from '@managers/ItemJsonManager';

import { DebugLogger } from '@utils/debug';

import data from '../OnFiled/items.json';

export const ItemSvgCanvas: React.FC<{ height: number; width: number }> = ({
  height,
  width,
}) => {
  const [draggedItem, setDraggedItem] = useState<BaseItemClass | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [collidingItem_, setCollidingItem] = useState<BaseItemClass>();

  const {
    addItem,
    toggleMount,
    componentItems,
    setComponentItems,
    mountedComponents,
    refs,
    itemButtons,
  } = useItemManager();

  const {
    isClassMapLoading,
    mapItemsFromJSON
  } = useItemJSONManager();

  useEffect(() => {
    let items: ItemComponent[] = [];
    if (!isClassMapLoading) {
      items = mapItemsFromJSON(data as unknown as ItemJSON[]);
    }

    DebugLogger.debug('Items:', items);

    items.map((item) => {
      addItem(item.id, item.Component, item.props);
      toggleMount(item.id);
    });
  }, [isClassMapLoading]);

  useEffect(() => {
    Object.values(refs.current).forEach(ref => {
      if (!ref.current) return;
    });
  }, [draggedItem]);

  const handleMouseDown = (id: string) => (event: MouseEvent) => {
    const targetComponent = refs.current[id].current;

    if (!targetComponent) {
      DebugLogger.warn(`No component found with ID: ${id}`);
      return;
    }

    setDraggedItem(targetComponent);

    const offsetX = event.clientX - targetComponent.state.x;
    const offsetY = event.clientY - targetComponent.state.y;
    setOffset({ x: offsetX, y: offsetY });

  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (draggedItem) {
      draggedItem.setPosition(
        event.clientX - offset.x,
        event.clientY - offset.y
      );
    }
  };

  const handleMouseUp = () => {
    if (draggedItem) {
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
        if (!refs.current[id]) {
          refs.current[id] = createRef();
        }
        return { id, Component, props, ref: refs.current[id] };
      })
      .filter(({ id }) => mountedComponents[id])
      .sort((a, b) => {
        const layerA = a.ref.current?.state.generation ?? 0;
        const layerB = b.ref.current?.state.generation ?? 0;
        return layerA - layerB;
      })
      .map(({ id, Component, props, ref }) => (
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
      </svg>
      {itemButtons()}
    </div>
  );
};

export default ItemSvgCanvas;