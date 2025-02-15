// ItemMenu.tsx
import React from 'react';
import './ItemMenuPanel.css';

import { BaseItemClass } from '@base/base/base-item';

interface ItemMenuProps {
  selectedCategory: string;
  items: { [key: string]: BaseItemClass[] };
}

const ItemMenuPanel: React.FC<ItemMenuProps> = ({ selectedCategory, items }) => {
  return (
    <div className="item-sidebar">
      <h3 className="selected-category">{selectedCategory}</h3>
      <ul className="item-list">
      { /*

        {items[selectedCategory].map(item => (
            <li key={item} className="item">{item}</li>
        ))}

        */
      }

      </ul>
    </div>
  );
};

export default ItemMenuPanel;
