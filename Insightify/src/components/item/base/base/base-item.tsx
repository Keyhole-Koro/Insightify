import React, { Component } from 'react';
import { RGBColor, Colors } from "@utils/color";

export interface BaseItemProps {
  id?: number;
  x?: number;
  y?: number;
  x_offset?: number;
  y_offset?: number;
  collision_width?: number;
  collision_height?: number;
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

  componentDidMount(): void {
    console.log("componentDidMount base item");
  }

  // Update these methods to use setState
  setID(id: number): void {
    this.setState({ id });
  }

  setX(x: number): void {
    this.setState({ x });
  }

  setY(y: number): void {
    this.setState({ y });
  }

  setScale(scale: number): void {
    this.setState({ scale });
  }

  setColor(color: RGBColor): void {
    this.setState({ color });
  }

  setXOffset(x_offset: number): void {
    this.setState({ x_offset });
  }

  setYOffset(y_offset: number): void {
    this.setState({ y_offset });
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
    if (child === this.state.item_parent || this.state.item_childs.includes(child)) return;
    this.addChild(child);
    child.addParent(this);
  }

  beChildOf(item_parent: BaseItemClass): void {
    if (this.state.item_childs.includes(item_parent)) return;
    this.setOffset(this.state.x - item_parent.state.x, this.state.y - item_parent.state.y);
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
      this.setState((prevState) => ({
        item_childs: [...prevState.item_childs, child]
      }));
    }
  }

  addParent(parent: BaseItemClass): void {
    this.setState({ item_parent: parent });
  }

  removeChild(child: BaseItemClass): void {
    this.setState((prevState) => ({
      item_childs: prevState.item_childs.filter((c) => c !== child)
    }));
  }
  
  removeParent(): void {
    this.setState({ item_parent: null });
  }

  abstract render(): JSX.Element;
  abstract get collision_width(): number;
  abstract get collision_height(): number;
}
