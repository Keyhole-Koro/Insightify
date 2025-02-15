import { BaseItemProps } from '@base/base/base-item';

export interface ItemJSON {
    id: string;
    className: string;
    props: BaseItemProps;
    childs?: ItemJSON[];
  }