import type { Meta, StoryObj } from '@storybook/vue3';
import Input from './Input.vue';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date'],
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
    errorMessage: 'Please enter a valid email address',
  },
};

export const WithHelpText: Story = {
  args: {
    label: 'Username',
    placeholder: 'Choose a username',
    helpText: 'Must be at least 3 characters long',
  },
};

export const Required: Story = {
  args: {
    label: 'Password',
    type: 'password',
    required: true,
    placeholder: 'Enter your password',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'This is disabled',
    disabled: true,
    modelValue: 'Some value',
  },
};

export const NumberInput: Story = {
  args: {
    label: 'Amount',
    type: 'number',
    placeholder: '0.00',
    helpText: 'Enter amount in USD',
  },
};

export const DateInput: Story = {
  args: {
    label: 'Date',
    type: 'date',
  },
};
