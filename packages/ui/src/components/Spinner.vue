<template>
  <div :class="containerClasses">
    <div :class="spinnerClasses" :style="{ width: size, height: size }" />
    <p v-if="text" class="text-sm text-gray-600">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface SpinnerProps {
  size?: string;
  text?: string;
  fullscreen?: boolean;
}

const props = withDefaults(defineProps<SpinnerProps>(), {
  size: '2rem',
  fullscreen: false,
});

const containerClasses = computed(() => {
  const base = 'flex flex-col items-center justify-center gap-3';
  const fullscreenClass = props.fullscreen 
    ? 'fixed inset-0 bg-white/80 z-[9999]' 
    : '';
  
  return [base, fullscreenClass];
});

const spinnerClasses = 'inline-block border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin';
</script>
