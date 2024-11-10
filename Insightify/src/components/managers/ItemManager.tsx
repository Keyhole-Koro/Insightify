import React, { useState, useEffect, useRef, RefObject, createRef } from 'react';
import { BaseItemClass, BaseItemProps } from '@base/base/base-item';
import { Rectangle, Circle, TextInput } from '@llitems/items';
import { Colors } from '@utils/color';
import { TextAlignment } from '@utils/alignment';
import { DebugLogger } from '@utils/debug';

interface ItemComponent {
  id: number;
  Component: React.ComponentType<any>;
  props: BaseItemProps;
}

export const useItemManager = () => {
  const [curId, setCurId] = useState(0);
  const [componentItems, setComponentItems] = useState<ItemComponent[]>([]);
  const [mountedComponents, setMountedComponents] = useState<{ [key: number]: boolean }>({});
  const refs = useRef<{ [key: number]: RefObject<BaseItemClass> }>({}); // Use useRef for persistent refs

  const [groups, setGroups] = useState<{ [key: number]: BaseItemClass[] }>({});

  useEffect(() => {
    // Initial setup of components
    const rect1 = { x: 300, y: 200, width: 100, height: 100, color: Colors.green };
    const rect2 = { x: 100, y: 100, width: 100, height: 100, color: Colors.red };
    const rect3 = { x: 200, y: 400, width: 100, height: 100, color: Colors.blue };
    const circle1 = { x: 500, y: 500, radius: 50, color: Colors.yellow };
    const textInput = { x: 100, y: 100, width: 100, height: 200, text: 'Hello', font_size: 20, font_color: Colors.green, box_color: Colors.black, alignment: TextAlignment.CENTER };
    
    addItem(Rectangle, rect1);
    addItem(Rectangle, rect2);
    addItem(Rectangle, rect3);
    addItem(Circle, circle1);
    addItem(TextInput, textInput);

    toggleMount(1);
    toggleMount(4);
    toggleMount(5);
  }, []);

  const toggleMount = (id: number) => {
    setMountedComponents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addItem = (Component: React.ComponentType<any>, props: BaseItemProps) => {
    setCurId((prevId) => {
      const newId = prevId + 1;
      setComponentItems((prevComponentItems) => {
        const ItemComponent: ItemComponent = {
          id: newId,
          Component: Component,
          props: props,
        };

        // Create a ref for the new item
        refs.current[newId] = createRef<BaseItemClass>();

        return [...prevComponentItems, ItemComponent];
      });
      return newId;
    });
  };

  const itemButtons = () => {
    return componentItems.map(({ id }) => (
      <button key={id} onClick={() => toggleMount(id)}>
        {`Toggle ${id}`}
      </button>
    ))
  };

  return {
    componentItems,
    setComponentItems,
    mountedComponents,
    refs,
    groups,
    setGroups,
    addItem,
    toggleMount,
    itemButtons,
  };
};