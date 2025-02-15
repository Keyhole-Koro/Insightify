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
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

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
    // Update the canvas width and height based on the SVG element
    const updateCanvasDimensions = () => {
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        setCanvasWidth(width);
        setCanvasHeight(height);
      }
    };

    // Listen for window resize to update the canvas size
    window.addEventListener('resize', updateCanvasDimensions);

    // Initial update
    updateCanvasDimensions();

    // Cleanup the event listener when the component is unmounted
    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
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

  // Function to generate grid lines
  const renderGrid = () => {
    const gridSpacing = 20; // Set the grid spacing here
    const widthNum = canvasWidth;
    const heightNum = canvasHeight;
    
    const horizontalLines = [];
    const verticalLines = [];

    // Generate horizontal grid lines
    for (let y = gridSpacing; y < heightNum; y += gridSpacing) {
      horizontalLines.push(
        <line
          key={`horizontal-${y}`}
          x1={0}
          y1={y}
          x2={widthNum}
          y2={y}
          stroke="#D3D3D3" // Thin gray color
          strokeWidth={0.5}
        />
      );
    }

    // Generate vertical grid lines
    for (let x = gridSpacing; x < widthNum; x += gridSpacing) {
      verticalLines.push(
        <line
          key={`vertical-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={heightNum}
          stroke="#D3D3D3" // Thin gray color
          strokeWidth={0.5}
        />
      );
    }

    return (
      <>
        {horizontalLines}
        {verticalLines}
      </>
    );
  };

  return (
    <svg
      ref={svgRef}
      width={width} // Explicitly use the width passed as a prop (percentage-based)
      height={height} // Explicitly use the height passed as a prop (percentage-based)
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {renderGrid()} {/* Render the grid first to ensure it's behind the items */}
      {renderItems()} {/* Render the items on top of the grid */}
    </svg>
  );
};

export default ItemSvgCanvas;
