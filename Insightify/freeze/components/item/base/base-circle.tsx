import './css/circle.css';
import React from 'react';
import { BaseItemClass, BaseItemProps, BaseItemState } from '@base/base/base-item';
import { rgb } from '@utils/color';

export interface BaseCircleItemProps extends BaseItemProps {
  radius?: number;
  rx?: number;
  ry?: number;
}

export interface BaseCircleItemState extends BaseItemState {
  rx: number;
  ry: number;
}

export abstract class BaseCircleClass<
    P extends BaseCircleItemProps = BaseCircleItemProps,
    S extends BaseCircleItemState = BaseCircleItemState
  > extends BaseItemClass<P, S> {

  constructor(props: P) {
    super(props);
    const defaultRadius = props.radius ?? 0;
    this.state = {
      ...this.state,
      rx: props.rx ?? defaultRadius,
      ry: props.ry ?? defaultRadius,
    };
  }
  
  get collision_width(): number {
    return this.state.rx * 2;
  }

  get collision_height(): number {
    return this.state.ry * 2;
  }

  verticalResizing(newHeight: number): void {
    this.setState({ ry: newHeight / 2 });
  }

  horizontalResizing(newWidth: number): void {
    this.setState({ rx: newWidth / 2 });
  }

  render(additionalProps: React.SVGProps<SVGEllipseElement> = {}): JSX.Element {
    const { x, y, color, rx, ry } = this.state;
    const { mouseDownHandler } = this.props;

    return (
      <ellipse
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        fill={rgb(color)}
        style={{ cursor: 'pointer' }}
        onMouseDown={mouseDownHandler}
        {...additionalProps}
      />
    );
  }
}
