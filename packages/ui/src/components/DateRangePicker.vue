<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input
        v-model="localFromDate"
        type="date"
        :label="fromLabel"
        :error="!!errorMessage"
        :disabled="disabled"
        @blur="handleFromChange"
      />
      <Input
        v-model="localToDate"
        type="date"
        :label="toLabel"
        :error="!!errorMessage"
        :disabled="disabled"
        @blur="handleToChange"
      />
    </div>
    <p v-if="errorMessage" class="text-sm text-red-500">{{ errorMessage }}</p>
    <p v-else-if="helpText" class="text-sm text-gray-500">{{ helpText }}</p>
    <div v-if="presets && presets.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-transparent border border-transparent rounded-md hover:bg-gray-100 transition-all duration-150"
        @click="applyPreset(preset)"
      >
        {{ preset.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Input from './Input.vue';

export interface DateRangePreset {
  label: string;
  fromDate: string;
  toDate: string;
}

export interface DateRangePickerProps {
  fromDate?: string;
  toDate?: string;
  fromLabel?: string;
  toLabel?: string;
  disabled?: boolean;
  errorMessage?: string;
  helpText?: string;
  presets?: DateRangePreset[];
}

const props = withDefaults(defineProps<DateRangePickerProps>(), {
  fromDate: '',
  toDate: '',
  fromLabel: 'From Date',
  toLabel: 'To Date',
  disabled: false,
});

const emit = defineEmits<{
  'update:fromDate': [value: string];
  'update:toDate': [value: string];
  change: [value: { fromDate: string; toDate: string }];
}>();

const localFromDate = ref(props.fromDate);
const localToDate = ref(props.toDate);

watch(() => props.fromDate, (newVal) => {
  localFromDate.value = newVal;
});

watch(() => props.toDate, (newVal) => {
  localToDate.value = newVal;
});

const handleFromChange = () => {
  emit('update:fromDate', localFromDate.value);
  emit('change', { fromDate: localFromDate.value, toDate: localToDate.value });
};

const handleToChange = () => {
  emit('update:toDate', localToDate.value);
  emit('change', { fromDate: localFromDate.value, toDate: localToDate.value });
};

const applyPreset = (preset: DateRangePreset) => {
  localFromDate.value = preset.fromDate;
  localToDate.value = preset.toDate;
  emit('update:fromDate', preset.fromDate);
  emit('update:toDate', preset.toDate);
  emit('change', { fromDate: preset.fromDate, toDate: preset.toDate });
};
</script>
