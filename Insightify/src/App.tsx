import React, { useEffect } from 'react';
import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';

import { useItemManager } from '@managers/ItemManager';
import { Colors } from '@utils/color';
import { TextAlignment } from '@utils/alignment';

import { Rectangle, Circle, TextInput } from '@llitems/items';

const App: React.FC = () => {

  const {
    addItem,
    toggleMount
  } = useItemManager();


  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <SvgCanvas height={800} width={1000}/>
    </div>
  );
};

export default App;