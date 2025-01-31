import React, { useEffect } from 'react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import SvgCanvas from '@SvgCanvas/ItemSvgCanvas';

import { useItemManager } from '@managers/ItemManager';

import ItemCreateMenu from '@components/ItemCreateMenu/ItemCreateMenu';

const App: React.FC = () => {

  const {
    addItem,
    toggleMount
  } = useItemManager();


  return (
    <div>
      <ItemCreateMenu />
    </div>
  );
};
//<SvgCanvas height={800} width={1000}/>
export default App;