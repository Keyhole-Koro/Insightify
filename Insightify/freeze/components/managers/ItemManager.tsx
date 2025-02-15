import React, { useState, useEffect, useRef, RefObject, createRef } from 'react';
import { BaseItemClass, BaseItemProps } from '@base/base/base-item';
import { useFamilyManager } from '@components/managers/ItemFamilyManager';
import { ItemComponent } from '@managers/interface/ItemComponent';

export const useItemManager = () => {
  const [curId, setCurId] = useState(0);
  const [componentState, setComponentState] = useState<{ [key: string]: ItemComponent}>({});

  const { linkItems } = useFamilyManager();

  useEffect(() => {
    if (!componentState) return; 
  }, [componentState, linkItems]);

  const toggleMount = (id: string) => {
    setComponentState((prev) => {
      if (!prev[id]) {
        console.warn(`Component with ID "${id}" not found.`);
        return prev; // Early return if the ID is invalid
      }
  
      return {
        ...prev,
        [id]: {
          ...prev[id],
          mounted: !prev[id].mounted, // Toggle mounted state
        },
      };
    });
  };
  
  const addItem = (id: string, Component: React.ComponentType<any>, props: BaseItemProps) => {
    setCurId((prevId) => {
      const newId = prevId + 1;
      setComponentState((prevComponentState) => ({
        ...prevComponentState,
        [id]: {
          id: id,
          Component: Component,
          props: props,
          ref: createRef<BaseItemClass>(),
          mounted: false
        }
      }));
      return newId;
    });
  };

  const itemButtons = () => {
    return Object.keys(componentState).map((id) => (
      <button key={id} onClick={() => toggleMount(id)}>
        {`Toggle ${id}`}
      </button>
    ));
  };

  return {
    addItem,
    toggleMount,
    itemButtons,
    componentState,
  };
};