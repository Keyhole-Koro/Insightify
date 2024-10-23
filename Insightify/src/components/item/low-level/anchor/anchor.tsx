import React from 'react';
import { RGBColor, Colors, rgb } from '@utils/color'
import { BaseCircleClass } from '@components/item/base/base-circle';

export class Anchor extends BaseCircleClass {
  radius: number;

  constructor({
    radius = 10,
    ...rest
  }: Partial<BaseCircleClass>) {
    super({ ...rest });
    this.radius = radius;
  }

  render(): JSX.Element {
    return this.renderTemplate({});
  }
}