<template>
  <div class="flex flex-col items-center justify-center p-8 text-center text-gray-500">
    <div v-if="$slots.icon" class="w-16 h-16 mb-4 text-gray-400">
      <slot name="icon" />
    </div>
    <svg
      v-else
      class="w-16 h-16 mb-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
    <h3 v-if="title" class="text-lg font-semibold text-gray-900 mb-2">{{ title }}</h3>
    <p v-if="description" class="text-sm text-gray-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface EmptyStateProps {
  title?: string;
  description?: string;
}

defineProps<EmptyStateProps>();
</script>
