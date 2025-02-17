import React, { useEffect, useState } from 'react';
import 'react-complex-tree/lib/style-modern.css';
import "rc-dock/dist/rc-dock.css";
import TreePanel, { CustomTreeItem } from '@components/TreePanel';
import ViewPanel, { CodeObj } from '@components/ViewPanel';
import { DockLayout as DockLayoutType } from 'rc-dock';
import { initialCodes, items } from './presets';
import { ItemProvider, useItemContext } from './contexts/ItemContext';

const DockLayout = DockLayoutType as any;

const AppContent: React.FC = () => {
  const { _items, addItem } = useItemContext();
  const [codes, setCodes] = useState<CodeObj[]>(initialCodes);
  const [selectedFile, setSelectedFile] = useState<CustomTreeItem | null>(null);

  const handleFileSelect = (file: CustomTreeItem) => {
    setSelectedFile(file);
  };

  useEffect(() => {
    initialCodes.forEach(addItem);
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    const { data, content, isFolder } = selectedFile;
    if (isFolder) return;
    addItem({ code: content ?? "", x: 50, y: 50 });
  }, [selectedFile]);

  const itemTree = {
    dockbox: {
      mode: 'horizontal',
      children: [
        {
          mode: 'vertical',
          size: 150,
          children: [
            {
              tabs: [
                {
                  id: 'tab1',
                  title: 'tab1',
                  content: <TreePanel items={items} onFileSelect={handleFileSelect} />,
                  minWidth: 200,
                  maxWidth: 400,
                  preferredWidth: 200
                }
              ]
            }
          ]
        },
        {
          mode: 'horizontal',
          size: 800,
          children: [
            {
              tabs: [
                {
                  id: 'tab2',
                  title: 'tab2',
                  content: <ViewPanel codes={codes} setCodes={setCodes} />,
                }
              ]
            }
          ]
        }
      ]
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, margin: 10 }}>
        <DockLayout
          defaultLayout={itemTree}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ItemProvider>
      <AppContent />
    </ItemProvider>
  );
};

export default App;