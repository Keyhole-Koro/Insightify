import React from 'react';
import { BaseItemClass, BaseItemProps, BaseItemState } from './base/base-item';
import { RGBAColor, Colors, rgb } from "@utils/color";
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

  get collision_width(): number {
    return this.state.width;
  }

  get collision_height(): number {
    return this.state.height;
  }

  verticalResizing(newHeight: number) {
    this.setState({ height: newHeight });
  }

  horizontalResizing(newWidth: number) {
    this.setState({ width: newWidth });
  }

  updateDimensions(width: number, height: number) {
    this.setState({ width, height });
  }

  render(): JSX.Element {
    const { x, y, color, width, height } = this.state;
    const { mouseDownHandler } = this.props;

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={rgb(color)}
        onMouseDown={mouseDownHandler}
        />
    );
  }
}