import React, { useState, useEffect, useRef } from 'react';
import { BaseItemClass } from '@base/base/base-item';
import { Rectangle, Circle } from '@llitems/items';
import { Colors } from '@utils/color';

interface ItemComponent {
  id: number;
  Component: React.ComponentType<any>;
  item: BaseItemClass; // Actual instance of the rectangle
}

export const useItemManager = () => {
  const [curId, setCurId] = useState(0);
  const [componentItems, setComponentItems] = useState<ItemComponent[]>([]);
  const [mountedComponents, setMountedComponents] = useState<{ [key: number]: boolean }>({});
  const refs = useRef<{ [key: number]: React.RefObject<any> }>({}); // Using useRef to avoid re-creation

  useEffect(() => {
    console.log("componentDidMount");

    const rect1 = new Rectangle({ x: 300, y: 200, width: 100, height: 100, color: Colors.green });
    const rect2 = new Rectangle({ x: 100, y: 100, width: 100, height: 100, color: Colors.red });
    const rect3 = new Rectangle({ x: 200, y: 400, width: 100, height: 100, color: Colors.blue });
    const circle1 = new Circle({ x: 500, y: 500, radius: 50, color: Colors.yellow });
    addItem(rect1);
    addItem(rect2);
    addItem(rect3);
    addItem(circle1);

    toggleMount(1);
    toggleMount(4);
  }, []);

  const toggleMount = (id: number) => {
    setMountedComponents((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const addItem = (component: BaseItemClass) => {
    const Component = component.constructor as React.ComponentType<any>;
    setCurId((prevId) => {
      const newId = prevId + 1;
      setComponentItems((prevComponentItems) => {
        const item: ItemComponent = {
          id: newId,
          Component: Component,
          item: component
        };
        return [...prevComponentItems, item];
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

  const renderItems = () => {
    return componentItems.map(({ id, Component, item }) => (
      mountedComponents[id] && (
        <Component key={id} ref={refs.current[id]} {...item.props} />
      )
    ));
  };
  
  return { addItem, toggleMount, itemButtons, renderItems, componentItems };
};
/*
      {componentItems.map(({ id }) => (
        <div key={id}>
          <button onClick={() => toggleMount(id)}>
            {mountedComponents[id] ? `Unmount ${id}` : `Mount ${id}`}
          </button>
        </div>
      ))}
        */

export const ItemManager = () => {
  const { renderItems, itemButtons } = useItemManager();
  return (
    <div>
      <svg width={800} height={600}>
        {renderItems()}
      </svg>
      {itemButtons()}
    </div>
  );
};