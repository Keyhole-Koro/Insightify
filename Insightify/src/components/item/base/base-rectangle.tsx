import React from 'react';
import { BaseItemClass, BaseItemProps, BaseItemState } from './base/base-item';
import { RGBColor, Colors, rgb } from "@utils/color";
import { Rectangle } from '../low-level/items';

export interface BaseRectangleItemProps extends BaseItemProps {
  width: number;
  height: number;
}

export interface BaseRectangleItemState extends BaseItemState {
  width: number;
  height: number;
}

export class BaseRectangle<
  P extends BaseRectangleItemProps = BaseRectangleItemProps,
  S extends BaseRectangleItemState = BaseRectangleItemState
> extends BaseItemClass<P, S> {
  
  constructor(
    props: P,
  ) {
    super(props);
    this.state = {
      ...this.state,
      width: props.width,
      height: props.height,
    };
  }

  componentDidMount(): void {
    console.log("componentDidMount");
  }

  get collision_width(): number {
    return this.state.width * this.state.scale;
  }

  get collision_height(): number {
    return this.state.height * this.state.scale;
  }

  updateDimensions(width: number, height: number) {
    this.setState({ width, height });
  }

  render(): JSX.Element {
    const { x, y, scale, color } = this.state;
    const { width, height } = this.state;

    return (
      <rect
        x={x}
        y={y}
        width={width * scale}
        height={height * scale}
        fill={rgb(color)}
      />
    );
  }
}