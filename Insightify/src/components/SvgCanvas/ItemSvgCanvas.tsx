import React, { createRef, useEffect, useState, useRef } from 'react';
import { useItemManager } from '@managers/ItemManager';
import { BaseItemClass } from '@base/base/base-item';
import { Point } from '@utils/math';
import { useItemJSONManager } from '@managers/ItemJsonManager';
import { ItemJSON } from '@managers/interface/ItemJSON';
import { DebugLogger } from '@utils/debug';
import data from '../ItemSample/items.json';

export const ItemSvgCanvas: React.FC<{ height: string; width: string }> = ({
  height,
  width,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggedItem, setDraggedItem] = useState<BaseItemClass | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [collidingItem_, setCollidingItem] = useState<BaseItemClass>();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const { addItem, toggleMount, itemButtons, componentState } = useItemManager();
  const { isClassMapLoading, mapItemsFromJSON } = useItemJSONManager();
  const [itemsToMount, setItemsToMount] = useState<string[]>([]);

  useEffect(() => {
    if (itemsToMount.length > 0) {
      // Toggle mount for each item in the list
      itemsToMount.forEach((id) => toggleMount(id));
      setItemsToMount([]); // Clear the list after mounting
    }
  }, [itemsToMount, toggleMount]);

  useEffect(() => {
    if (!isClassMapLoading) {
      const items = mapItemsFromJSON(data as unknown as ItemJSON[]);
      DebugLogger.log('Items:', items);

      items.forEach((item) => {
        addItem(item.id, item.Component, item.props); // No need to pass id; auto-generated
      });

      // Queue items to be mounted after state updates
      setItemsToMount(items.map((item) => item.id));
    }
  }, [isClassMapLoading]);

  useEffect(() => {
    const updateCanvasSize = () => {
      if (svgRef.current) {
        setCanvasSize({
          width: svgRef.current.clientWidth,
          height: svgRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (svgRef.current) {
      resizeObserver.observe(svgRef.current);
    }

    // Initial size calculation
    updateCanvasSize();

    return () => {
      if (svgRef.current) {
        resizeObserver.unobserve(svgRef.current);
      }
    };
  }, []);

  const handleMouseDown = (id: string) => (event: MouseEvent) => {
    const targetRef: BaseItemClass | null = componentState[id]?.ref?.current || null;

    if (!targetRef) {
      DebugLogger.warn(`No component found with ID: ${id}`);
      return;
    }

    setDraggedItem(targetRef);

    if (!targetRef) {
      DebugLogger.warn(`Component ref is null for ID: ${id}`);
      return;
    }
    const offsetX = event.clientX - targetRef.state.x;
    const offsetY = event.clientY - targetRef.state.y;
    setOffset({ x: offsetX, y: offsetY });
  };

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
    return Object.values(componentState)
      .map(({ id, Component, props, mounted, ref }) => {
        return { id, Component, props, ref: ref, mounted: mounted };
      })
      .filter(({ mounted }) => mounted)
      .sort((a, b) => {
        const layerA = a.ref?.current?.state?.generation ?? 0;
        const layerB = b.ref?.current?.state?.generation ?? 0;
        return layerA - layerB;
      })
      .map(({ id, Component, props, ref }) => (
        <Component
          key={`itemSvgCanvas_${id}`}
          id={id}
          ref={ref ?? createRef<BaseItemClass>()}
          {...props}
          mouseDownHandler={handleMouseDown(id)} // Ensure proper event handling
        />
      ));
  };

  return (
    <svg
      ref={svgRef}
      width={canvasSize.width}
      height={canvasSize.height}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {renderItems()}
    </svg>
  );
};

export default ItemSvgCanvas;
