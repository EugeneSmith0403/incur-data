# @incur-data/ui

Shared UI component library for the incur-data project.

## Features

- 🎨 Modern, accessible component library
- 📦 Tree-shakeable ESM exports
- 🔧 Built with Vue 3 and TypeScript
- 📚 Documented with Storybook
- 🎯 Fully typed props and events
- 🎭 Customizable via CSS variables

## Components

### Form Components
- **Input** - Text, email, password, number, date inputs with validation
- **Textarea** - Multi-line text input
- **Select** - Dropdown selection
- **DateRangePicker** - Date range selection with presets

### UI Components
- **Button** - Primary, secondary, danger, ghost variants
- **Card** - Container with header, body, and footer slots
- **Alert** - Info, success, warning, danger notifications
- **EmptyState** - Empty state placeholder
- **Spinner** - Loading indicator

## Installation

This package is part of the incur-data monorepo and uses pnpm workspaces.

```bash
pnpm add @incur-data/ui
```

## Usage

### Basic Import

```vue
<script setup lang="ts">
import { Button, Input, Card } from '@incur-data/ui';
</script>

<template>
  <Card>
    <template #header>
      <h3>Login Form</h3>
    </template>
    
    <Input 
      v-model="email"
      type="email"
      label="Email"
      placeholder="Enter your email"
    />
    
    <Button type="submit" variant="primary">
      Submit
    </Button>
  </Card>
</template>
```

### Import Styles

In your Nuxt config or main entry file:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['@incur-data/ui/dist/style.css'],
});
```

Or in your main TypeScript/JavaScript file:

```typescript
import '@incur-data/ui/dist/style.css';
```

## Development

### Run Storybook

```bash
pnpm storybook
```

This will start Storybook on `http://localhost:6006`

### Build

```bash
pnpm build
```

### Type Checking

```bash
pnpm type-check
```

## CSS Variables

The component library uses CSS variables for theming:

```css
:root {
  --ui-primary: #3b82f6;
  --ui-primary-hover: #2563eb;
  --ui-success: #10b981;
  --ui-danger: #ef4444;
  --ui-warning: #f59e0b;
  --ui-border-radius: 6px;
  /* ... and more */
}
```

Override these variables in your app to customize the theme.

## Component Examples

### Input

```vue
<Input
  v-model="username"
  label="Username"
  placeholder="Enter username"
  required
  :error-message="errors.username"
  help-text="Must be at least 3 characters"
/>
```

### Button

```vue
<Button variant="primary" size="lg" :loading="isSubmitting">
  Submit Form
</Button>
```

### DateRangePicker

```vue
<DateRangePicker
  v-model:from-date="fromDate"
  v-model:to-date="toDate"
  :presets="datePresets"
  @change="handleDateChange"
/>
```

### Card

```vue
<Card>
  <template #header>
    <h3>Card Title</h3>
  </template>
  
  <p>Card content goes here</p>
  
  <template #footer>
    <Button>Action</Button>
  </template>
</Card>
```

## License

MIT
