import React from 'react';
import { BaseTextboxClass, BaseTextboxItemProps, BaseTextboxItemState } from '@base/base-textbox';

export interface TextboxProps extends BaseTextboxItemProps {}

interface TextboxState extends BaseTextboxItemState {}

export class TextInput extends BaseTextboxClass<TextboxProps, TextboxState> {
  constructor(props: TextboxProps) {
    super(props);
  }

  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ text: event.target.value });
  };

  render(additionalProps?: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
    return super.render({
        ...additionalProps,
        onChange: this.handleInputChange
      });
    }
}

