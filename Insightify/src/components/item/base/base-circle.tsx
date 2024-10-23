import './css/circle.css';

import React from 'react';
import { BaseItemClass } from '@base/base-item';
import { rgb } from '@utils/color';

export abstract class BaseCircleClass extends BaseItemClass {
  radius: number;

  constructor({
    radius = 50,
    ...rest
  }: Partial<BaseItemClass> & { radius?: number } = {}) {
    super({ ...rest });
    this.radius = radius;
  }

  abstract render(): JSX.Element;

  renderTemplate(additionalProps: React.SVGProps<SVGCircleElement> = {}): JSX.Element {
    return (
      <circle
        cx={this.x}
        cy={this.y}
        r={this.radius * this.scale}
        fill={rgb(this.color)}
        style={{ cursor: 'pointer' }}
        {...additionalProps}
      />
    );
  }

  get width(): number {
    return this.radius * 2 * this.scale;
  }

  get height(): number {
    return this.radius * 2 * this.scale;
  }
}