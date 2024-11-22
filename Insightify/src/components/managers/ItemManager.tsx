import React, { useState, useEffect, useRef, RefObject, createRef } from 'react';
import { BaseItemClass, BaseItemProps } from '@base/base/base-item';

export interface ItemComponent {
  id: string;
  Component: React.ComponentType<any>;
  props: BaseItemProps;
  parent_id?: string | null;
  child_ids?: string[];
}

export const useItemManager = () => {
  const [curId, setCurId] = useState(0);
  const [componentItems, setComponentItems] = useState<ItemComponent[]>([]);
  const [mountedComponents, setMountedComponents] = useState<{ [key: string]: boolean }>({});
  const refs = useRef<{ [key: string]: RefObject<BaseItemClass> }>({}); // Use useRef for persistent refs

  const toggleMount = (id: string) => {
    setMountedComponents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addItem = (id: string, Component: React.ComponentType<any>, props: BaseItemProps) => {
    let newId = 0;
    setCurId((prevId) => {
      newId = prevId + 1;
      setComponentItems((prevComponentItems) => {
        const ItemComponent: ItemComponent = {
          id: id,
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
    addItem,
    toggleMount,
    itemButtons,
  };
};