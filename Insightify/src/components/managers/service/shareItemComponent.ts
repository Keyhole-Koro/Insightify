import { BaseItemClass } from '@components/item/base/base/base-item';
import { ItemComponent } from '@managers/interface/ItemComponent'; 
import { createContext, RefObject } from 'react';

export interface SharedItemComponentStateContextType {
    sharedValue: ItemComponent[];
    setSharedValue: React.Dispatch<React.SetStateAction<ItemComponent[]>>;
}

export interface SharedMountedItemComponentStateContextType {
    sharedValue: RefObject<{ [key: string]: RefObject<BaseItemClass> }>;
}

export const SharedItemCompnentStateContext = createContext<SharedItemComponentStateContextType | undefined>(undefined);

export const SharedMountedItemCompnentStateContext = createContext<SharedMountedItemComponentStateContextType | undefined>(undefined);
