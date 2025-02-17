import React from 'react';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItem, TreeItemIndex } from 'react-complex-tree';

export interface CustomTreeItem extends TreeItem {
  content?: string;
  isFolder?: boolean; // Add this property to indicate if the item is a folder
}

interface TreePanelProps {
  items: Record<string, CustomTreeItem>;
  onFileSelect: (file: CustomTreeItem) => void;
}

const TreePanel: React.FC<TreePanelProps> = ({ items, onFileSelect }) => {
  const dataProvider = new StaticTreeDataProvider(items, (item, newName) => ({ ...item, data: newName }));

  const handleSelect = (items: TreeItemIndex[], treeId: string) => {
    if (items.length > 0) {
      const selectedItem = items[0];
      dataProvider.getTreeItem(selectedItem).then(file => {
        if (!file.isFolder) { // Check if the selected item is not a folder
          onFileSelect(file as CustomTreeItem);  // <-- Passing selected file to the parent
        }
      }).catch(err => console.error('Error fetching selected item:', err));
    }
  };

  return (
    <UncontrolledTreeEnvironment
      dataProvider={dataProvider}
      getItemTitle={item => item.data}
      viewState={{}}
      canDragAndDrop={true}
      canDropOnFolder={true}
      canReorderItems={true}
      onSelectItems={handleSelect}
    >
      <Tree treeId="tree-2" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>
  );
};

export default TreePanel;