import React from 'react';
import { ItemManager, useItemManager } from '@managers/ItemManager'; // Ensure ItemManager is correctly imported
//import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';

const App: React.FC = () => {
  //const { renderItems } = useItemManager;
  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <ItemManager/>
    </div>
  );
};

export default App;
//<SvgCanvas itemManager={new ItemManager({})} width={1000} height={1000} />
