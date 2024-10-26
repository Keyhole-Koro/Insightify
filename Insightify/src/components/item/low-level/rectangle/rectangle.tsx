import React, { Component } from 'react';
import { RGBColor, rgb } from '@utils/color';
import { BaseRectangle, BaseRectangleItemProps, BaseRectangleItemState } from '@base/base-rectangle';

interface RectangleProps extends BaseRectangleItemProps {}

interface RectangleState extends BaseRectangleItemState {}

export class Rectangle extends BaseRectangle<RectangleProps, RectangleState> {

  constructor(
    props: BaseRectangleItemProps) {
    super( props );
  }

}