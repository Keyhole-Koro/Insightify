import React from 'react';
import { BaseItemClass, BaseItemProps, BaseItemState } from '@base/base/base-item';

export interface BaseTextboxItemProps extends BaseItemProps {
  width: number;
  height: number;
  text: string;
}

export interface BaseTextboxItemState extends BaseItemState {
  width: number;
  height: number;
  text: string;
}

export abstract class BaseTextboxClass<
  P extends BaseTextboxItemProps = BaseTextboxItemProps,
  S extends BaseTextboxItemState = BaseTextboxItemState
> extends BaseItemClass<P, S> {

  constructor(
    props: P,
  ) {
    super(props);
    this.state = {
      ...this.state,
      width: props.width,
      height: props.height,
      text: props.text ?? '',
    };
  }

  //additionalProps: React.InputHTMLAttributes<HTMLInputElement> = {}

  render(additionalProps?: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
    const { x, y, width, height, text } = this.state;

    return (
      <foreignObject
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <input
          value={text}
          {...additionalProps}
          style={{ width: '100%', height: '100%', textAlign: 'center' }}
        />
      </foreignObject>
    );
  }
  get collision_width(): number {
    return this.state.width;
  }

  get collision_height(): number {
    return this.state.height;
  }
}