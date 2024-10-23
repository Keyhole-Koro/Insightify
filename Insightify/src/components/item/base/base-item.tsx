import React from 'react';
import { RGBColor, Colors } from "../../utils/color";

export abstract class BaseItemClass {
  id: number;
  x: number;
  y: number;
  scale: number;
  color: RGBColor;

  parent?: BaseItemClass | undefined;
  pastParent?: BaseItemClass | undefined;
  childs: BaseItemClass[];
  // used for specify the distance between child and parent 
  x_offset: number;
  y_offset: number;

  constructor({
    id = -1,
    x = 0,
    y = 0,
    x_offset = 0,
    y_offset = 0,
    scale = 1,
    color = Colors.gray,
    parent = undefined,
    childs = []
  }: Partial<BaseItemClass> = {}) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.x_offset = x_offset;
    this.y_offset = y_offset;
    this.scale = scale;
    this.color = color;
    this.parent = parent;
    this.childs = childs;
  }

  setPosition(x: number, y: number): void {
    this.x = x + this.x_offset;
    this.y = y + this.y_offset;
  
    this.childs.forEach((child) => {
      child.setPosition(x, y);
    });
  } 

  setOffset(x_offset: number, y_offset: number): void {
    this.x_offset = x_offset;
    this.y_offset = y_offset;
  }

  beParentOf(child: BaseItemClass): void {
    this.addChild(child);
    child.addParent(this);
  }

  beChildOf(parent: BaseItemClass): void {
    this.setOffset(
      this.x - parent.x,
      this.x - parent.y
    );

    parent.addChild(this);
    this.addParent(parent);
  }

  stopBeingParentOf(child: BaseItemClass): void {
    this.removeChild(child);
    child.removeParent();
  }

  stopBeingChildOf(parent: BaseItemClass): void {
    this.setOffset(
      0,
      0
    );
    this.pastParent = parent;

    this.removeParent();
    parent.removeChild(this);
  }  

  addChild(child: BaseItemClass): void {
    if (!this.childs.includes(child)) {
      this.childs.push(child);
    }
  }

  addParent(parent: BaseItemClass): void {
    if (this.parent !== parent) {
      this.parent = parent;
    }
  }

  removeChild(child: BaseItemClass): void {
    this.childs = this.childs.filter(c => c !== child);
  }

  removeParent(): void {
    if (this.parent) {
      this.parent = undefined;    
    }
  }
  
  abstract render(): JSX.Element;

  abstract get width(): number;
  abstract get height(): number;
}