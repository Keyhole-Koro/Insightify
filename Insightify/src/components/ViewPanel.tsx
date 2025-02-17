import React, { useState, useEffect } from 'react';
import Script from '@components/Script';
import { useItemContext } from '@contexts/ItemContext';

export interface CodeObj {
  code: string;
  x: number;
  y: number;
  language?: string;
}

interface ViewerPanelProps {
  codes: CodeObj[];
  setCodes: React.Dispatch<React.SetStateAction<CodeObj[]>>;
}

const ViewPanel: React.FC<ViewerPanelProps> = ({ codes, setCodes }) => {
  const { _items, addItem } = useItemContext();

  const handleCodeChange = (index: number, newCode: string) => {
    setCodes(prevCodes => {
      const newCodes = [...prevCodes];
      newCodes[index].code = newCode;
      return newCodes;
    });
  };

  const handleDrag = (index: number, newX: number, newY: number) => {
    setCodes(prevCodes => {
      const newCodes = [...prevCodes];
      newCodes[index].x = newX;
      newCodes[index].y = newY;
      return newCodes;
    });
  };

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {_items.map((codeObj, index) => (
        <div
          key={index}
          style={{ position: 'absolute', left: codeObj.x, top: codeObj.y }}
        >
          <Script
            x={codeObj.x}
            y={codeObj.y}
            code={codeObj.code}
            setCode={(newCode) => handleCodeChange(index, newCode)}
            language={codeObj.language}
            onDrag={(newX, newY) => handleDrag(index, newX, newY)}
            children={null}
          />
        </div>
      ))}
    </div>
  );
};

export default ViewPanel;