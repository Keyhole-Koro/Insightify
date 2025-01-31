import React, { useState } from 'react';
import './ItemCreateMenu.css';

import { ResponsiveProps, WidthProviderProps, Responsive, WidthProvider } from "react-grid-layout";

import CategoryMenu from './CategoryMenu';
import ItemMenu from './ItemMenu';
import ItemSvgCanvas from '@SvgCanvas/ItemSvgCanvas';
import useScreenManager from '@managers/useScreenManager';

const categories = ['recently used', 'often used', 'Category 1'];
const items: { [key: string]: string[] } = {
  'recently used': ['Item 2.1', 'Item 2.2', 'Item 2.3'],
  'often used': ['Item 3.1', 'Item 3.2', 'Item 3.3'],
  'Category 1': ['Item 1.1', 'Item 1.2', 'Item 1.3'],
};

const ItemCreateMenu: React.FC = () => {
  const ResponsiveGridLayout = WidthProvider(Responsive) as React.ComponentType<ResponsiveProps & WidthProviderProps>;

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);

  const row = 30;
  return (
    <div className="item-create-wrapper">
      <ResponsiveGridLayout
        className="layout"
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={row}
        width={1200}
        isDraggable={false}
        isResizable={false}
        resizeHandles={['se']}
        allowOverlap={false}

      >
        {/* Category Sidebar */}
        <div
          key="categorySidebar"
          data-grid={{ x: 0, y: 0, w: 1, h: row }} // Set width and height for the category sidebar
        >
          <CategoryMenu 
            categories={categories} 
            selectedCategory={selectedCategory} 
            onCategorySelect={setSelectedCategory}
          />
        </div>

        {/* Item Sidebar */}
        <div
          key="itemSidebar"
          data-grid={{ x: 1, y: 0, w: 3, h: row }} // Set width and height for the item sidebar
        >
          <ItemMenu 
            selectedCategory={selectedCategory} 
            items={items} 
          />
        </div>

        {/* Canvas Container */}
        <div
          key="canvas"
          data-grid={{ x: 4, y: 0, w: 5, h: 16 }} // Full height for the canvas
          className="canvas-container"
        >
          {/* Responsive width and height for ItemSvgCanvas */}
          <ItemSvgCanvas width="100%" height="100%" />
        </div>

      </ResponsiveGridLayout>
    </div>
  );
};

export default ItemCreateMenu;
