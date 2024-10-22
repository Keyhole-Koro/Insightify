import React from 'react';
import ItemManager from '@managers/ItemManager';
import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';
import { Circle, Rectangle } from '@llitems/items';
import { Colors } from '@utils/color'

const App: React.FC = () => {
  const itemManager = new ItemManager();

  const circle1 = new Circle({ order: 5, x: 100, y: 100, radius: 50, color: Colors.red });
  itemManager.addItem(circle1);
  itemManager.addItem(new Circle({ order: 2, x: 200, y: 100, radius: 30, color: Colors.blue }));
  itemManager.addItem(new Rectangle({ x: 300, y: 300, width: 100, height: 100, color: Colors.red }));

  //itemManager.removeItem(circle1);


  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <SvgCanvas itemManager={itemManager} width={1000} height={1000}/>
    </div>
  );
};

export default App;