<template>
  <div class="mb-6">
    <label v-if="label" :for="id" class="block mb-2 text-sm font-medium text-gray-700" :class="{ 'after:content-[\'_*\'] after:text-red-500': required }">
      {{ label }}
    </label>
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :class="selectClasses"
      @change="handleChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="errorMessage" class="mt-1 text-sm text-red-500">{{ errorMessage }}</p>
    <p v-else-if="helpText" class="mt-1 text-sm text-gray-500">{{ helpText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps {
  modelValue?: string | number;
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  helpText?: string;
  id?: string;
}

const props = withDefaults(defineProps<SelectProps>(), {
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const id = computed(() => props.id || `select-${Math.random().toString(36).substr(2, 9)}`);

const selectClasses = computed(() => {
  const base = 'w-full px-3.5 py-2.5 text-sm leading-6 text-gray-900 bg-white border rounded-md transition-all duration-150 outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';
  const errorClass = props.error || props.errorMessage 
    ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
    : 'border-gray-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-100';
  
  return [base, errorClass];
});

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>
