import { useEffect, useState } from 'react';

import { ItemComponent } from '@managers/interface/ItemComponent';
import { ItemJSON } from './interface/ItemJSON';

import { DebugLogger } from '@utils/debug';

type ClassMap = Record<string, React.ComponentType<any>>;

/**
 * Dynamically builds a map of class constructors from @llitems/items.
 */
const buildClassMap = async (): Promise<ClassMap> => {
  try {
    const items = await import('@llitems/items');
    const classMap: ClassMap = {};

    Object.entries(items).forEach(([key, value]) => {
      if (typeof value === 'function' || typeof value === 'object') {
        classMap[key] = value as React.ComponentType<any>;
      }
    });

    return classMap;
  } catch (error) {
    console.error('Error building class map:', error);
    throw new Error('Failed to load class map');
  }
};

export const useItemJSONManager = () => {
  const [classMap, setClassMap] = useState<ClassMap | null>(null);
  const [isClassMapLoading, setIsClassMapLoading] = useState(true);
  const [items, setItems] = useState<ItemComponent[]>([]);

  // Load the class map when the component using this hook mounts
  useEffect(() => {
    DebugLogger.log('Loading class map...');
    const loadClassMap = async () => {
      try {
        const map = await buildClassMap();
        DebugLogger.log('Class map loaded:', map);
        setClassMap(map);
      } catch (error) {
        console.error(error);
      } finally {
        setIsClassMapLoading(false);
      }
    };

    loadClassMap();
  }, []);

  /**
   * Get a class by its name from the controlled map.
   * @param className The name of the class.
   * @returns The class constructor or null if not found.
   */
  const getClassByName = (className: string): React.ComponentType<any> | null => {
    if (!classMap) {
      console.warn('Class map is not loaded yet.');
      return null;
    }
    return classMap[className] || null;
  };

  const mapItemsFromJSON = (items: ItemJSON[] = [], parent: string | null = null): ItemComponent[] => {
    if (!classMap) {
      console.warn('Class map is not loaded yet.');
      return [];
    }
  
    return items.flatMap(item => {
      const childItems = item.childs ? mapItemsFromJSON(item.childs, item.id) : [];
      return [...childItems, mapItemFromJSON(item, parent, childItems.map(child => child.id))];
    });
  };

  const mapItemFromJSON = (item: ItemJSON, parentId: string | null = null, childIds: string[] = []): ItemComponent => {
    const ClassConstructor = getClassByName(item.className);
    if (!ClassConstructor) {
      throw new Error(`Class not found for className: ${item.className}`);
    }


    return {
      id: item.id,
      Component: ClassConstructor,
      props: item.props,
      parent_id: parentId ?? null,
      child_ids: childIds,
      mounted: false,
    };
  }

  return {
    items,
    mapItemsFromJSON,
    isClassMapLoading,
  };
};