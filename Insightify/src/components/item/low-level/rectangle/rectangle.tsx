import React from 'react';
import { RGBColor, rgb } from '@utils/color';
import { BaseRectangleClass } from '@components/item/base/base-rectangle';

export class Rectangle extends BaseRectangleClass {
  constructor({
    width = 100,
    height = 100,
    ...rest
  }: Partial<BaseRectangleClass>) {
    super({ ...rest });
    this._width = width;
    this._height = height;
  }

  render(): JSX.Element {
    return this.renderTemplate({});
  }

  get width(): number {
    return this._width * this.scale;
  }

  get height(): number {
    return this._height * this.scale;
  }
}