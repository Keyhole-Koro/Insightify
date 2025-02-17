import React, { useState } from 'react';
import Script from '@components/Script';

const ViewPanel: React.FC = () => {
  const initialCodes = [
    { code: `function add(a, b) {\n  return a + b;\n}`, language: 'javascript', x: 50, y: 100 },
    { code: `def add(a, b): \n  return a + b\n`, language: 'python', x: 200, y: 300 }
  ];

  const [codes, setCodes] = useState(initialCodes);

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
      {codes.map((codeObj, index) => (
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