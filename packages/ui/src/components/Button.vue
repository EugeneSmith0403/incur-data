<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <span v-if="loading" class="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface ButtonProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonClasses = computed(() => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium text-center whitespace-nowrap border rounded-md cursor-pointer transition-all duration-150 outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'text-white bg-primary-500 border-primary-500 hover:bg-primary-600 hover:border-primary-600 active:bg-primary-700 active:border-primary-700',
    secondary: 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50',
    danger: 'text-white bg-red-500 border-red-500 hover:bg-red-600 hover:border-red-600',
    ghost: 'text-gray-700 bg-transparent border-transparent hover:bg-gray-100',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };
  
  return [base, variants[props.variant], sizes[props.size]];
});

const handleClick = (event: MouseEvent) => {
  emit('click', event);
};
</script>
