import React, { useState } from 'react';
import Script from '@components/Script';

const ViewPanel: React.FC = () => {
  const sample1 = `function add(a, b) {\n  return a + b;\n}`;
  const sample2 = `def add(a, b): \n  return a + b\n`;
  
  const [codes, setCodes] = useState([sample1, sample2]);

  const handleCodeChange = (index: number, newCode: string) => {
    setCodes(prevCodes => {
      const newCodes = [...prevCodes];
      newCodes[index] = newCode;
      return newCodes;
    });
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, margin: '10px' }}>
        <Script code={codes[0]} setCode={(newCode) => handleCodeChange(0, newCode)} language="javascript" />
      </div>
      <div style={{ flex: 1, margin: '10px' }}>
        <Script code={codes[1]} setCode={(newCode) => handleCodeChange(1, newCode)} language="python" />
      </div>
    </div>
  );
};

export default ViewPanel;