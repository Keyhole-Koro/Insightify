import React from 'react';
import { BaseCircleClass, BaseCircleItemProps, BaseCircleItemState } from '@base/base-circle';
import { rgb } from '@utils/color';

interface CircleProps extends BaseCircleItemProps {}

interface CircleState extends BaseCircleItemState {}

export class Circle extends BaseCircleClass <CircleProps, CircleState> {

  constructor(
    props: BaseCircleItemProps
  ) {
    super( props );
  }
}