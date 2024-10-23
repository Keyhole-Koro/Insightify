import './css/rectangle.css';

import React from 'react';
import { BaseItemClass } from '@components/item/base/base-item';
import { RGBColor, rgb } from '@utils/color';

export abstract class BaseRectangleClass extends BaseItemClass {
  _width: number;
  _height: number;

  constructor({
    width = 100,
    height = 100,
    ...rest
  }: Partial<BaseItemClass> & { width?: number; height?: number } = {}) {
    super({ ...rest });
    this._width = width;
    this._height = height;
  }

  abstract render(): JSX.Element;

  renderTemplate(additionalProps: React.SVGProps<SVGRectElement> = {}): JSX.Element {
    return (
      <rect
        x={this.x}
        y={this.y}
        width={this.width}
        height={this.height}
        fill={rgb(this.color)}
        style={{ cursor: 'pointer' }}
        {...additionalProps}
    />
    );
  }

  get width(): number {
    return this._width * this.scale;
  }

  get height(): number {
    return this._height * this.scale;
  }
}