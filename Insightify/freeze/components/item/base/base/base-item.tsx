import React, { Component, RefObject } from 'react';

import { RGBAColor, Colors } from "@utils/color";
import { DebugLogger } from '@utils/debug';

export interface BaseItemProps {
  x?: number;
  y?: number;
  x_offset?: number;
  y_offset?: number;
  collision_width?: number;
  collision_height?: number;
  color?: RGBAColor;
  generation?: number;
  item_parent?: BaseItemClass<BaseItemProps, any> | null;
  item_childs?: BaseItemClass<BaseItemProps, any>[];
  mouseDownHandler?: (e: React.MouseEvent) => void
}

export interface BaseItemState {
  x: number;
  y: number;
  x_offset: number;
  y_offset: number;
  color: RGBAColor;
  generation: number;
  item_parent: BaseItemClass<BaseItemProps, any> | null;
  item_childs: BaseItemClass<BaseItemProps, any>[];
}

export abstract class BaseItemClass<
  P extends BaseItemProps = BaseItemProps,
  S extends BaseItemState = BaseItemState
> extends Component<P, S> {

  constructor(props: P) {
    super(props);
    this.state = {
      ...this.state,
      x: props.x ?? 0,
      y: props.y ?? 0,
      x_offset: props.x_offset ?? 0,
      y_offset: props.y_offset ?? 0,
      color: props.color ?? Colors.gray,
      generation: props.generation ?? 0,
      item_parent: props.item_parent ?? null,
      item_childs: props.item_childs ?? [],
      mouseDownHandler: props.mouseDownHandler ?? {}
    } as S;
  }

  setPosition(x: number, y: number): void {
    this.setState({ x, y }, () => {
      this.state.item_childs.forEach((child) => {
        child.setPosition(x + child.state.x_offset, y + child.state.y_offset);
      });
    });
  }

  setOffset(x_offset: number, y_offset: number): void {
    this.setState({ x_offset, y_offset });
  }

  beParentOf(child: BaseItemClass): void {
    if (this.lookForAncestors(child) || this.lookForDescendants(child)) return;

    this.addChild(child);
    child.addParent(this);
  }

  beChildOf(parent: BaseItemClass): void {
    if (this.lookForAncestors(parent) || this.lookForDescendants(parent)) return;

    this.setOffset(this.state.x - parent.state.x, this.state.y - parent.state.y);
    parent.addChild(this);
    this.addParent(parent);
  }

  stopBeingParentOf(child: BaseItemClass): void {
    this.removeChild(child);
    child.removeParent();
  }

  stopBeingChildOf(parent: BaseItemClass): void {
    this.setOffset(0, 0);
    this.removeParent();
    parent.removeChild(this);
  }

  setRelevantGen(): void {
    const lastAncestor = this.lastAncestor();
    if (!lastAncestor) return;
    this._setRelevantGen(0, lastAncestor);
  }
  
  private _setRelevantGen(curGen: number, item: BaseItemClass): void {
    if (!item) return;
  
    this.setState({ generation: curGen });

    const nextGen = curGen + 1;
    item.state.item_childs.forEach((child) => {
      this._setRelevantGen(nextGen, child);
    });
  }

  lastAncestor(): BaseItemClass | null {
    const parent = this.state.item_parent;
    if (parent) {
      return parent.lastAncestor();
    } else {
      return parent;
    }
  }

  lookForAncestors(target: BaseItemClass): BaseItemClass | null {
    const parent = this.state.item_parent;
    if (!parent) return null;
    if (parent === target) return parent;
    
    return this.lookForAncestors(parent);
  }

  lookForDescendants(target: BaseItemClass): BaseItemClass | null {
    return this._lookForDescendants(target, this.state.item_childs);
  }

  private _lookForDescendants(target: BaseItemClass, childs: BaseItemClass[]): BaseItemClass | null {
    for (const child of childs) {
      if (child === target) return child;
      const found = this._lookForDescendants(target, child.state.item_childs);
      if (found) return found;
    }
    
    return null;
  }

  private addChild(child: BaseItemClass): void {
    if (!this.state.item_childs.includes(child)) {
      this.setState((prevState) => ({
        item_childs: [...prevState.item_childs, child]
      }));
    }
  }

  private addParent(parent: BaseItemClass): void {
    this.setState({ item_parent: parent });
  }

  private removeChild(child: BaseItemClass): void {
    this.setState((prevState) => ({
      item_childs: prevState.item_childs.filter((c) => c !== child)
    }));
  }
  
  private removeParent(): void {
    this.setState({ item_parent: null });
  }

  abstract render(): JSX.Element;
  abstract get collision_width(): number;
  abstract get collision_height(): number;

  abstract verticalResizing(newHeight: number): void;
  abstract horizontalResizing(newWidth: number): void;
}
