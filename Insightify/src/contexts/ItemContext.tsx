import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CodeObj } from '@components/ViewPanel';

interface ItemContextProps {
  _items: CodeObj[];
  addItem: (item: CodeObj) => void;
}

const ItemContext = createContext<ItemContextProps | undefined>(undefined);

export const ItemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [_items, setItems] = useState<CodeObj[]>([]);

  useEffect(() => {
    console.log('hook Items:', _items);
  }, [_items]);

  const addItem = (item: CodeObj) => {
    setItems((prevItems) => [...prevItems, item]);
  };

  return (
    <ItemContext.Provider value={{ _items, addItem }}>
      {children}
    </ItemContext.Provider>
  );
};

export const useItemContext = () => {
  const context = useContext(ItemContext);
  if (!context) {
    throw new Error('useItemContext must be used within an ItemProvider');
  }
  return context;
};