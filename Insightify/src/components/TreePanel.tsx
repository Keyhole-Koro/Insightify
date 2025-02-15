// src/components/TreePanel.tsx
import React, { useState } from 'react';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItem } from 'react-complex-tree';

export interface CustomTreeItem extends TreeItem {
  index: string;
  isFolder?: boolean;
  children: string[];
  data: string;
}

interface TreePanelProps {
  items: Record<string, CustomTreeItem>
}

const TreePanel: React.FC<TreePanelProps> = ({ items }) => {

  const dataProvider = new StaticTreeDataProvider(items, (item, newName) => ({ ...item, data: newName }));

  return (
    <UncontrolledTreeEnvironment
      dataProvider={dataProvider}
      getItemTitle={item => item.data}
      viewState={{}}
      canDragAndDrop={true}
      canDropOnFolder={true}
      canReorderItems={true}
    >
      <Tree treeId="tree-2" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>
  );
};

export default TreePanel;
