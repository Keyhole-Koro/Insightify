import './css/textbox.css';

import React from 'react';
import { rgb, rgba, Colors, RGBAColor } from '@utils/color';
import { BaseItemClass, BaseItemProps, BaseItemState } from '@base/base/base-item';
import { TextAlignment } from '@utils/alignment';

export interface BaseTextboxItemProps extends BaseItemProps {
  width?: number;
  height?: number;
  text?: string;
  font_color?: RGBAColor;
  font_size?: number;
  box_color?: RGBAColor;
  alignment?: TextAlignment;
}

export interface BaseTextboxItemState extends BaseItemState {
  width: number;
  height: number;
  text: string;
  font_color: RGBAColor;
  font_size: number;
  box_color: RGBAColor;
  alignment: TextAlignment;
}

export abstract class BaseTextboxClass<
  P extends BaseTextboxItemProps = BaseTextboxItemProps,
  S extends BaseTextboxItemState = BaseTextboxItemState
> extends BaseItemClass<P, S> {
  
  constructor(props: P) {
    super(props);
    this.state = {
      ...this.state,
      width: props.width,
      height: props.height,
      text: props.text ?? '',
      font_color: props.font_color ?? Colors.black,
      box_color: props.box_color ?? Colors.transparent,
      font_size: props.font_size ?? 12,
      alignment: props.alignment ?? TextAlignment.CENTER,
    };
  }

  // scalable width and height of the textbox element

  render(additionalProps: React.InputHTMLAttributes<HTMLInputElement> = {}): JSX.Element {
    const { x, y, width, height, text, font_color, box_color, alignment, font_size } = this.state;

    return (
      <foreignObject
        x={x}
        y={y}
        width={width}
        height={height}
      >
        <input
          value={text}
          style={{
            alignSelf: alignment,
            color: rgba(font_color),
            backgroundColor: rgba(box_color),
            fontSize: font_size
          }}
          {...additionalProps}
        />
      </foreignObject>
    );
  }

  get collision_width(): number {
    return this.state.width;
  }

  get collision_height(): number {
    return this.state.height;
  }
}
