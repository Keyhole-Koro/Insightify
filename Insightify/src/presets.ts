import TreePanel, { CustomTreeItem } from '@components/TreePanel';
import ViewPanel, { CodeObj } from '@components/ViewPanel';


const items: Record<string, CustomTreeItem> = {
    root: {
      index: 'root',
      isFolder: true,
      children: ['src', 'public', 'packageJson'],
      data: 'Root project folder',
    },
    src: {
      index: 'src',
      isFolder: true,
      children: ['App.tsx', 'index.tsx', 'components'],
      data: 'Source folder',
    },
    public: {
      index: 'public',
      isFolder: true,
      children: ['index.html'],
      data: 'Public folder',
    },
    packageJson: {
      index: 'packageJson',
      children: [],
      data: 'package.json',
      content: '{ "name": "project", "version": "1.0.0" }',
    },
    'App.tsx': {
      index: 'App.tsx',
      children: [],
      data: 'App.tsx',
      content: 'import React from "react";\n\nconst App = () => <div>Hello World</div>;\n\nexport default App;',
    },
    'index.tsx': {
      index: 'index.tsx',
      children: [],
      data: 'index.tsx',
      content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\n\nReactDOM.render(<App />, document.getElementById("root"));',
    },
    components: {
      index: 'components',
      isFolder: true,
      children: ['Tile.tsx'],
      data: 'Components folder',
    },
    'Tile.tsx': {
      index: 'Tile.tsx',
      children: [],
      data: 'Tile.tsx',
      content: 'import React from "react";\n\nconst Tile = () => <div>Tile Component</div>;\n\nexport default Tile;',
    },
    'index.html': {
      index: 'index.html',
      children: [],
      data: 'index.html',
      content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Project</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>',
    },
  };

  const initialCodes: CodeObj[] = [
    { code: `function add(a, b) {\n  return a + b;\n}`, language: 'javascript', x: 50, y: 100 },
    { code: `def add(a, b): \n  return a + b\n`, language: 'python', x: 200, y: 300 }
  ];

  export { initialCodes, items };