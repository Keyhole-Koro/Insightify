import { useContext } from 'react';
import { ItemComponent } from '@managers/interface/ItemComponent';
import { BaseItemClass } from '@base/base/base-item';
import { SharedItemCompnentStateContext, SharedMountedItemCompnentStateContext } from '@managers/service/shareItemComponent';

import { DebugLogger } from '@utils/debug';
import { link } from 'fs';

export const useFamilyManager = () => {
  const itemProps = useContext(SharedItemCompnentStateContext);
  const mountedItemRefs = useContext(SharedMountedItemCompnentStateContext);

  const linkItems = (items: ItemComponent[]) => {
    if (!itemProps || !mountedItemRefs) {
      DebugLogger.warn('No items found');
      return;
    }
    
    items.forEach(item => linkItem(item));
  };

  const linkItem = (item: ItemComponent) => {
    if (!itemProps || !mountedItemRefs) {
      DebugLogger.warn('No items found');
      return;
    }
    
    item.props.item_parent = getParent(item.parent_id ?? '');
    item.props.item_childs = getChlids(item.child_ids ?? []);
  }

  const getParent = (id: string): BaseItemClass | undefined => {
    if (!mountedItemRefs || !mountedItemRefs.sharedValue.current) {
      DebugLogger.warn('No items found');
      return undefined;
    }
    return mountedItemRefs.sharedValue.current[id].current ?? undefined;
  }

  const getChlids = (ids: string[]): BaseItemClass[] => {
    if (!mountedItemRefs || !mountedItemRefs.sharedValue.current) {
      DebugLogger.warn('No items found');
      return [];
    }

    if (!mountedItemRefs.sharedValue.current) {
      return [];
    }
    return ids.map(id => mountedItemRefs.sharedValue.current![id]?.current).filter(item => item !== undefined) as BaseItemClass[];
  }
  return {
    linkItems,
    linkItem,
  };
}; 