<template>
  <div class="bg-white border border-gray-300 rounded-lg shadow-sm">
    <div v-if="$slots.header" class="px-6 py-4 border-b border-gray-300">
      <slot name="header" />
    </div>
    <div class="p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-6 py-4 bg-gray-50 border-t border-gray-300">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Card component with header, body, and footer slots
</script>
