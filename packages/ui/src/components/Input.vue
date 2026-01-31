<template>
  <div class="mb-6">
    <label v-if="label" :for="id" class="block mb-2 text-sm font-medium text-gray-700" :class="{ 'after:content-[\'_*\'] after:text-red-500': required }">
      {{ label }}
    </label>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :class="inputClasses"
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

export interface InputProps {
  modelValue?: string | number;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  helpText?: string;
  id?: string;
}

const props = withDefaults(defineProps<InputProps>(), {
  type: 'text',
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  blur: [event: FocusEvent];
  focus: [event: FocusEvent];
}>();

const id = computed(() => props.id || `input-${Math.random().toString(36).substr(2, 9)}`);

const inputClasses = computed(() => {
  const base = 'w-full px-3.5 py-2.5 text-sm leading-6 text-gray-900 bg-white border rounded-md transition-all duration-150 outline-none disabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';
  const errorClass = props.error || props.errorMessage 
    ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
    : 'border-gray-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-100';
  
  return [base, errorClass];
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = props.type === 'number' ? parseFloat(target.value) || 0 : target.value;
  emit('update:modelValue', value);
};

const handleBlur = (event: FocusEvent) => {
  emit('blur', event);
};

const handleFocus = (event: FocusEvent) => {
  emit('focus', event);
};
</script>
