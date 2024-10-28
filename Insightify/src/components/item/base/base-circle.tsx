import './css/circle.css';

import React from 'react';
import { BaseItemClass, BaseItemProps, BaseItemState } from '@base/base/base-item';
import { rgb } from '@utils/color';

export interface BaseCircleItemProps extends BaseItemProps {
  radius: number;
}

export interface BaseCircleItemState extends BaseItemState {
  radius: number;
}


export abstract class BaseCircleClass<
    P extends BaseCircleItemProps = BaseCircleItemProps,
    S extends BaseCircleItemState = BaseCircleItemState
  > extends BaseItemClass<P, S> {

  constructor(
    props: P
  ){
    super(props);
    this.state = {
      ...this.state,
      radius: props.radius,
    };
  }

  render(additionalProps: React.SVGProps<SVGCircleElement> = {}): JSX.Element {
    const { x, y, scale, color } = this.state;
    const { radius } = this.state;

    return (
      <circle
        cx={x}
        cy={y}
        r={radius * scale}
        fill={rgb(color)}
        style={{ cursor: 'pointer' }}
        {...additionalProps}
      />
    );
  }

  get collision_width(): number {
    return this.state.radius * 2 * this.state.scale;
  }

  get collision_height(): number {
    return this.state.radius * 2 * this.state.scale;
  }
}