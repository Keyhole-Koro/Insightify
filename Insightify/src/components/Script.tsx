import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';

import Tile, { TileProps } from './Tile';

interface ScriptProps extends TileProps {
  code: string;
  setCode: (code: string) => void;
  language?: string;
}

const Script: React.FC<ScriptProps> = ({ code, setCode, language = 'javascript', ...titleProps }) => {
  return (
    <Tile {...titleProps}>
      <Editor
        value={code}
        onValueChange={code => setCode(code)}
        highlight={code => highlight(code, languages[language] ?? languages['javascript'], language)}
        padding={10}
        style={{
          fontFamily: '"Fira code", "Fira Mono", monospace',
          fontSize: 12,
          height: '100%',
          overflow: 'auto'
        }}
      />
    </Tile>
  );
};

export default Script;