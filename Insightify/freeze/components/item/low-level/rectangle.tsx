import React, { Component } from 'react';
import { RGBAColor, rgb } from '@utils/color';
import { BaseRectangle, BaseRectangleItemProps, BaseRectangleItemState } from '@base/base-rectangle';

export interface RectangleProps extends BaseRectangleItemProps {}

interface RectangleState extends BaseRectangleItemState {}

export class Rectangle extends BaseRectangle<RectangleProps, RectangleState> {

  constructor(
    props: BaseRectangleItemProps) {
    super( props );
  }

}