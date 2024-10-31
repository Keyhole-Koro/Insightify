import React, { useState, useEffect, useRef } from 'react';
import { BaseItemClass } from '@base/base/base-item';
import { Rectangle, Circle, TextInput } from '@llitems/items';
import { Colors } from '@utils/color';
import { TextAlignment } from '@utils/alignment';

interface ItemComponent {
  id: number;
  Component: React.ComponentType<any>;
  instance: BaseItemClass; // Actual instance
}

export const useItemManager = () => {
  const [curId, setCurId] = useState(0);
  const [componentItems, setComponentItems] = useState<ItemComponent[]>([]);
  const [mountedComponents, setMountedComponents] = useState<{ [key: number]: boolean }>({});
  const refs = useRef<{ [key: number]: BaseItemClass }>({}); // Using useRef to avoid re-creation

  useEffect(() => {
    const rect1 = new Rectangle({ x: 300, y: 200, width: 100, height: 100, color: Colors.green });
    const rect2 = new Rectangle({ x: 100, y: 100, width: 100, height: 100, color: Colors.red });
    const rect3 = new Rectangle({ x: 200, y: 400, width: 100, height: 100, color: Colors.blue });
    const circle1 = new Circle({ x: 500, y: 500, radius: 50, color: Colors.yellow });
    const textInput = new TextInput({ x: 100, y: 100, width: 100, height: 200, text: 'Hello', font_size: 20, font_color: Colors.green, box_color: Colors.black, alignment: TextAlignment.CENTER});
    addItem(rect1);
    addItem(rect2);
    addItem(rect3);
    addItem(circle1);
    addItem(textInput);

    toggleMount(1);
    toggleMount(4);
    toggleMount(5);
  }, []);

  const toggleMount = (id: number) => {
    setMountedComponents((prev) => {
        const newMounted = {
            ...prev,
            [id]: !prev[id],
        };
        if (!newMounted[id]) {
            delete refs.current[id]; // Clean up ref when unmounting
        }
        return newMounted;
    });
};


  const addItem = (instance: BaseItemClass) => {
    const Component = instance.constructor as React.ComponentType<any>;
    setCurId((prevId) => {
      const newId = prevId + 1;
      setComponentItems((prevComponentItems) => {
        const item: ItemComponent = {
          id: newId,
          Component: Component,
          instance: instance
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

  const checkCollision = (item1: BaseItemClass, item2: BaseItemClass): boolean => {
    const rect1 = { x: item1.state.x, y: item1.state.y, width: item1.collision_width, height: item1.collision_height };
    const rect2 = { x: item2.state.x, y: item2.state.y, width: item2.collision_width, height: item2.collision_height };

    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  const getCollidingItems = (instace: BaseItemClass): BaseItemClass[] => {
    const collidingItems: BaseItemClass[] = [];
    componentItems.forEach(({ instance: i }) => {
      if (i !== instace && checkCollision(instace, i)) {
        collidingItems.push(i);
      }
    });
    return collidingItems;
  };
  
  const bringChildItemAboveParentBelow = (item1: BaseItemClass, item2: BaseItemClass): void => {
    const isItem1ChildOfItem2: boolean = item1.state.item_parent === item2;
    const isItem2ChildOfItem1: boolean = item2.state.item_parent === item1;
  
    if (isItem1ChildOfItem2 || isItem2ChildOfItem1) {
      const childItem: BaseItemClass = isItem1ChildOfItem2 ? item1 : item2;
      const parentItem: BaseItemClass = isItem1ChildOfItem2 ? item2 : item1;
  
      setComponentItems((prevItems) => {
        // Remove the child item from the array
        const filteredItems = prevItems.filter(({ instance }) => instance !== childItem);
        // Find the index of the parent item
        const parentIndex = filteredItems.findIndex(({ instance }) => instance === parentItem);
  
        if (parentIndex !== -1) {
          // Insert the child item after the parent item
          filteredItems.splice(parentIndex + 1, 0, { id: prevItems[parentIndex].id, Component: Rectangle, instance: childItem });
        } else {
          console.error('Parent item not found in the items array');
        }
  
        return filteredItems;
      });
    } else {
      console.warn('No parent-child relationship found between the provided items');
    }
  };

  const findComponentByElement = () => {}


  return {
    componentItems,
    mountedComponents,
    refs,
    addItem,
    toggleMount,
    itemButtons,
    checkCollision,
    getCollidingItems,
    bringChildItemAboveParentBelow,
    findComponentByElement
  };
};

/*
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
*/