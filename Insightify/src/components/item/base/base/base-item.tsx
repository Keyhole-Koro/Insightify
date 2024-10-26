import React, { Component } from 'react';
import { RGBColor, Colors } from "@utils/color";

export interface BaseItemProps {
  id?: number;
  x?: number;
  y?: number;
  x_offset?: number;
  y_offset?: number;
  scale?: number;
  color?: RGBColor;
  item_parent?: BaseItemClass<BaseItemProps, any> | null;
  item_childs?: BaseItemClass<BaseItemProps, any>[];
}

export interface BaseItemState {
  id: number;
  x: number;
  y: number;
  x_offset: number;
  y_offset: number;
  scale: number;
  color: RGBColor;
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
      id: props.id ?? -1,
      x: props.x ?? 0,
      y: props.y ?? 0,
      x_offset: props.x_offset ?? 0,
      y_offset: props.y_offset ?? 0,
      scale: props.scale ?? 1,
      color: props.color ?? Colors.gray,
      item_parent: props.item_parent ?? null,
      item_childs: props.item_childs ?? [],
    } as S;
  }

  get id(): number {
    return this.state.id;
  }

  get x(): number {
    return this.state.x;
  }

  get y(): number {
    return this.state.y;
  }

  get x_offset(): number {
    return this.state.x_offset;
  }

  get y_offset(): number {
    return this.state.y_offset;
  }

  get scale(): number {
    return this.state.scale;
  }

  get color(): RGBColor {
    return this.state.color;
  }

  setID(id: number): void {
    this.state = { ...this.state, id: id };
  }
  
  setX(x: number): void {
    this.state = { ...this.state, x: x };

  }

  setY(y: number): void {
    this.state = { ...this.state, y: y };
  }

  setScale(scale: number): void {
    this.state = { ...this.state, scale: scale };
  }

  setColor(color: RGBColor): void {
    this.state = { ...this.state, color: color };
  }

  setXOffset(x_offset: number): void {
    this.state = { ...this.state, x_offset: x_offset };
  }

  setYOffset(y_offset: number): void {
    this.state = { ...this.state, y_offset: y_offset };
  }

  setPosition(x: number, y: number): void {
    this.state = { ...this.state, x: x, y : y };
      this.state.item_childs.forEach((child) => {
        child.setPosition(x + child.state.x_offset, y + child.state.y_offset);
      });
  }

  setOffset(x_offset: number, y_offset: number): void {
    this.state = { ...this.state, x_offset: x_offset, y_offset: y_offset };
  }

  beParentOf(child: BaseItemClass): void {
    if (child === this.state.item_parent) return; // child can't be parent of parent
    if (this.state.item_childs.some((c) => c === child)) return; // avoid overlapping children

    this.addChild(child);
    child.addParent(this);
  }

  beChildOf(item_parent: BaseItemClass): void {
    if (this.state.item_childs.some((child) => child === item_parent)) return; // parent can't be child of child

    this.setOffset(
      this.state.x - item_parent.state.x,
      this.state.y - item_parent.state.y
    );

    item_parent.addChild(this);
    this.addParent(item_parent);
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

  addChild(child: BaseItemClass): void {
    if (!this.state.item_childs.includes(child)) {
      this.state.item_childs.push(child);
    }
  }

  addParent(parent: BaseItemClass): void {
    if (this.state.item_parent !== parent) {
      this.state = {
        ...this.state,
        item_parent : parent};
    }
  }
  removeChild(child: BaseItemClass): void {
    this.state = {
      ...this.state,
      item_childs: this.state.item_childs.filter((c) => c !== child)
    }; 
  }
  
  removeParent(): void {
    this.state = { ...this.state, item_parent: null };
  }
  
  abstract render(): JSX.Element;

  abstract get width(): number;
  abstract get height(): number;
}