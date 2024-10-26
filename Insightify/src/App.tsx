import React from 'react';
import ItemManager from '@managers/ItemManager';
import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';
import { Rectangle } from '@llitems/items';
import { Colors } from '@utils/color'

const App: React.FC = () => {
  const itemManager = new ItemManager();

  const rect1 = new Rectangle({ x: 300, y: 300, width: 100, height: 100, color: Colors.green });
  const rect2 = new Rectangle({ x: 100, y: 100, width: 100, height: 100, color: Colors.red });
  const rect3 = new Rectangle({ x: 200, y: 200, width: 100, height: 100, color: Colors.blue });
  itemManager.addItem(rect1);
  itemManager.addItem(rect2);
  itemManager.addItem(rect3);

  //circle1.beChildOf(rect1);
  //circle2.beParentOf(rect1);

  //itemManager.removeItem(circle1);


  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <SvgCanvas itemManager={itemManager} width={1000} height={1000}/>
    </div>
  );
};

export default App;