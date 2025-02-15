import { BaseItemClass, BaseItemProps } from '@base/base/base-item';

export interface ItemComponent {
    id: string,
    Component: React.ComponentType<any>,
    props: BaseItemProps,
    ref?: React.RefObject<BaseItemClass> | undefined,
    mounted: boolean,
    parent_id?: string | null,
    child_ids?: string[]
}