import type { Meta, StoryObj } from '@storybook/vue3';
import DateRangePicker from './DateRangePicker.vue';

const meta = {
  title: 'Components/DateRangePicker',
  component: DateRangePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    fromDate: '2024-01-01',
    toDate: '2024-01-31',
  },
};

export const WithPresets: Story = {
  args: {
    fromDate: '2024-01-01',
    toDate: '2024-01-31',
    presets: [
      {
        label: 'Last 7 Days',
        fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
      },
      {
        label: 'Last 30 Days',
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
      },
      {
        label: 'This Month',
        fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0],
      },
    ],
  },
};

export const WithError: Story = {
  args: {
    fromDate: '2024-01-01',
    toDate: '2024-01-31',
    errorMessage: 'Date range cannot exceed 90 days',
  },
};

export const WithHelpText: Story = {
  args: {
    fromDate: '2024-01-01',
    toDate: '2024-01-31',
    helpText: 'Select a date range to filter results',
  },
};
