export {}
/*
import React, { Component } from 'react';
import { BaseItemClass } from './base-item';

export interface BaseTextboxClassProps {
  width?: number;
  height?: number;
  text?: string;
}

interface BaseTextboxClassState {
  text: string;
}

export abstract class BaseTextboxClass extends BaseItemClass {
  _width: number;
  _height: number;
  text: string;

  constructor(props: BaseTextboxClassProps & Partial<BaseItemClass>) {
    super(props); // Call the constructor of BaseItemClass
    this._width = props.width || 100;
    this._height = props.height || 100;
    this.state = {
      text: props.text || '',
    };
    this.text = props.text || '';
  }

  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ text: event.target.value });
    console.log('Input value changed to:', event.target.value);
  };

  abstract render(): JSX.Element;

  renderTemplate(additionalProps: React.InputHTMLAttributes<HTMLInputElement> = {}): JSX.Element {
    return (
      <foreignObject
        x={this.x}
        y={this.y}
        width={this._width}
        height={this._height}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <input
          value={this.state.text}
          onChange={this.handleInputChange}
          {...additionalProps}
          style={{ width: '100%', height: '100%', textAlign: 'center' }}
        />
      </foreignObject>
    );
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }
}
*/