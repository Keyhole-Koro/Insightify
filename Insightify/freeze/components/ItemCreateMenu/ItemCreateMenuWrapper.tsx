import React, { useState } from 'react';
import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import './ItemCreateMenuWrapper.css';

import CategoryMenuPanel from './CategoryMenuPanel';
import ItemMenuPanel from './ItemMenuPanel';
import ItemSvgCanvas from '@SvgCanvas/ItemSvgCanvas';
import { BaseItemClass } from '@base/base/base-item';

const categories = ['recently used', 'often used', 'Category 1'];

interface ItemCreateMenuProps {
  items: { [key: string]: BaseItemClass[] };
}

const ItemCreateMenu: React.FC<ItemCreateMenuProps> = ({ items }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);

  return (
    <div className="item-create-wrapper" style={{ height: '100vh' }}>
      <Mosaic<string>
        renderTile={(id, path) => {
          switch (id) {
            case 'category':
              return (
                <MosaicWindow<string> title="Category" path={path}>
                  <div className="category-sidebar" style={{ padding: '5px', maxWidth: '200px' }}>
                    <CategoryMenuPanel 
                      categories={categories} 
                      selectedCategory={selectedCategory} 
                      onCategorySelect={setSelectedCategory}
                    />
                  </div>
                </MosaicWindow>
              );
            case 'items':
              return (
                <MosaicWindow<string> title="Items" path={path}>
                  <div className="item-sidebar" style={{ padding: '10px' }}>
                    <ItemMenuPanel 
                      selectedCategory={selectedCategory} 
                      items={items} 
                    />
                  </div>
                </MosaicWindow>
              );
            case 'canvas':
              return (
                <MosaicWindow<string> title="Canvas" path={path}>
                  <div className="canvas-container" style={{ padding: '10px' }}>
                    <ItemSvgCanvas width="100%" height="100%" />
                  </div>
                </MosaicWindow>
              );
            default:
              return null;
          }
        }}
        initialValue={{
          direction: 'row',
          first: 'category',
          second: {
            direction: 'row',
            first: 'items',
            second: 'canvas',
          },
        }}
      />
    </div>
  );
};

export default ItemCreateMenu;