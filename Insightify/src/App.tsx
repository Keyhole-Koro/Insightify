import 'react-complex-tree/lib/style-modern.css';

import React, { useState } from 'react';
import TreePanel, { CustomTreeItem } from '@components/TreePanel';
import ViewPanel from '@components/ViewPanel';

const App: React.FC = () => {

  const items: Record<string, CustomTreeItem> = {
    root: {
      index: 'root',
      isFolder: true,
      children: ['child1', 'child2'],
      data: 'Root item',
    },
    child1: {
      index: 'child1',
      children: [],
      data: 'Child item 1',
    },
    child2: {
      index: 'child2',
      isFolder: true,
      children: ['child3'],
      data: 'Child item 2',
    },
    child3: {
      index: 'child3',
      children: [],
      data: 'Child item 3',
    },
  };

  return (
    <div>
      <div style={{ display: 'flex' }}>
        <TreePanel items={items} />
      </div>
      <ViewPanel />
    </div>
  );
};

export default App;
