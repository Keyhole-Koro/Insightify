import React, { useEffect } from 'react';
import SvgCanvas from '@components/ItemSvgCanvas/ItemSvgCanvas';

const App: React.FC = () => {
  return (
    <div>
      <h1>Vector Items with SVG</h1>
      <SvgCanvas height={800} width={1000}/>
    </div>
  );
};

export default App;