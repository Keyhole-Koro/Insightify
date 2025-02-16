import React from 'react';

import "./Tile.css";

interface TileProps {
    children: React.ReactNode;
}

const Tile: React.FC<TileProps> = ({ children }) => {
  return (

    <div className="resize">
      <div className='tile' style={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
        {children}
      </div>
    </div>
  );
};

export default Tile;