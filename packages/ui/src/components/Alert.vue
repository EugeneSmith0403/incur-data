<template>
  <div :class="alertClasses" role="alert">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
}

const props = withDefaults(defineProps<AlertProps>(), {
  variant: 'info',
});

const alertClasses = computed(() => {
  const base = 'p-4 border rounded-md text-sm';
  
  const variants = {
    info: 'text-blue-900 bg-blue-50 border-blue-300',
    success: 'text-green-900 bg-green-50 border-green-300',
    warning: 'text-amber-900 bg-amber-50 border-amber-300',
    danger: 'text-red-900 bg-red-50 border-red-300',
  };
  
  return [base, variants[props.variant]];
});
</script>
