import React from 'react';
import { BaseCircleClass } from '@base/base-circle';
import { rgb } from '@utils/color';

export class Circle extends BaseCircleClass {
  radius: number;

  constructor({
    radius = 50,
    ...rest
  }: Partial<BaseCircleClass>) {
    super({ ...rest });
    this.radius = radius;
  }

  render(): JSX.Element {
    return this.renderTemplate({});
  }
}