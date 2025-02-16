import 'react-complex-tree/lib/style-modern.css';
import "rc-dock/dist/rc-dock.css";

import React from 'react';
import TreePanel, { CustomTreeItem } from '@components/TreePanel';
import ViewPanel from '@components/ViewPanel';

import { DockLayout as DockLayoutType } from 'rc-dock';

// Cast DockLayout to any to bypass type checking
const DockLayout = DockLayoutType as any;

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

  const itemTree = {
    dockbox: {
      mode: 'horizontal',
      children: [
        {
          tabs: [
            {
              id: 'tab1',
              title: 'tab1',
              content: <TreePanel items={items} />,
              minWidth: 200, // Minimum width of the tab
              maxWidth: 400, // Maximum width of the tab
              preferredWidth: 300 // Preferred width of the tab
            }
          ]
        }
      ]
    }
  };

  const Viewer = {
    dockbox: {
      mode: 'horizontal',
      children: [
        {
          tabs: [
            {
              id: 'tab1',
              title: 'tab1',
              content: <ViewPanel />,
              minWidth: 400, // Minimum width of the tab
              maxWidth: 800, // Maximum width of the tab
              preferredWidth: 700 // Preferred width of the tab
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
            width: '20%',
            height: '100%',
          }}
        />
      </div>
      <div style={{ flex: 1, margin: 10 }}>
        <DockLayout
          defaultLayout={Viewer}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    </div>
  );
};

export default App;