import React from 'react';
import { BaseCircleClass, BaseCircleItemProps, BaseCircleItemState } from '@base/base-circle';
import { rgb } from '@utils/color';

interface AnchorProps extends BaseCircleItemProps {}

interface AnchorState extends BaseCircleItemState {}

export class Anchor extends BaseCircleClass <AnchorProps, AnchorState> {

  constructor(
    props: BaseCircleItemProps
  ) {
    super( props );
  }
}