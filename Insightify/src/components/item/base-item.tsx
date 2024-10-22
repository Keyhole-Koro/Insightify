import React, { useState } from 'react';
import { RGBColor, Colors } from "../utils/color";

// Define the interface for dependencies
export interface BaseItem {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: RGBColor;

  setPosition(x: number, y: number): void;

  render(): JSX.Element;
}

export abstract class BaseItemClass implements BaseItem {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: RGBColor;

  constructor({
    id = -1,
    x = 0,
    y = 0,
    scale = 1,
    color = Colors.gray,
  }: Partial<BaseItem> = {}) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.color = color;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  abstract render(): JSX.Element;
}
