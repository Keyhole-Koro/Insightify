import React, { useRef, useState } from 'react';
import Draggable from 'react-draggable';

import './Tile.css';

export interface TileProps {
  x: number;
  y: number;
  onDrag: (x: number, y: number) => void;
  children: React.ReactNode;
}

const Tile: React.FC<TileProps> = ({ x, y, onDrag, children }) => {
  const draggableRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable
      nodeRef={draggableRef}
      defaultPosition={{ x, y }}
      handle=".handle"
    >
      <div ref={draggableRef} className="tile resize" style={{ height: '200px', width: '200px' }}>
        <div className="handle"></div>
        <div className="content" style={{ height: '180px' }}>
          {children}
        </div>
      </div>
    </Draggable>
  );
};

export default Tile;