<template>
  <div class="mb-6">
    <label v-if="label" :for="id" class="block mb-2 text-sm font-medium text-gray-700" :class="{ 'after:content-[\'_*\'] after:text-red-500': required }">
      {{ label }}
    </label>
    <textarea
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :rows="rows"
      :class="textareaClasses"
      @input="handleInput"
      @blur="handleBlur"
      @focus="handleFocus"
    />
    <p v-if="errorMessage" class="mt-1 text-sm text-red-500">{{ errorMessage }}</p>
    <p v-else-if="helpText" class="mt-1 text-sm text-gray-500">{{ helpText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface TextareaProps {
  modelValue?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  helpText?: string;
  rows?: number;
  id?: string;
}

const props = withDefaults(defineProps<TextareaProps>(), {
  modelValue: '',
  rows: 4,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();

const id = computed(() => props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`);

const textareaClasses = computed(() => {
  const base = 'w-full px-3.5 py-2.5 text-sm leading-6 text-gray-900 bg-white border rounded-md resize-y min-h-[100px] transition-all duration-150 outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';
  const errorClass = props.error || props.errorMessage 
    ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
    : 'border-gray-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-100';
  
  return [base, errorClass];
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};

const handleBlur = (event: FocusEvent) => {
  emit('blur', event);
};

const handleFocus = (event: FocusEvent) => {
  emit('focus', event);
};
</script>
