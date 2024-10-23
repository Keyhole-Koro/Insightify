import React from 'react';
import ItemManager from '@managers/ItemManager';
import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';
import { Anchor, Circle, Rectangle } from '@llitems/items';
import { Colors } from '@utils/color'

const App: React.FC = () => {
  const itemManager = new ItemManager();

  const circle1 = new Circle({ x: 100, y: 100, radius: 50, color: Colors.red });
  const circle2 = new Circle({ x: 200, y: 100, radius: 30, color: Colors.blue });
  const rect1 = new Rectangle({ x: 300, y: 300, width: 100, height: 100, color: Colors.green });
  itemManager.addItem(circle1);
  itemManager.addItem(circle2);
  itemManager.addItem(rect1);
  itemManager.addItem(new Anchor({ x: 300, y: 100, radius: 10, color: Colors.black }));

  circle1.beChildOf(rect1);
  circle2.beParentOf(rect1);

  //itemManager.removeItem(circle1);


  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <SvgCanvas itemManager={itemManager} width={1000} height={1000}/>
    </div>
  );
};

export default App;