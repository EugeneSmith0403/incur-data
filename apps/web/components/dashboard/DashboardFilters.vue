<template>
  <Card>
    <template #header>
      <h3 class="text-lg font-semibold text-gray-900 m-0">{{ $t('filters.title') }}</h3>
    </template>

    <form @submit.prevent="handleApply">
      <DateRangePicker
        v-model:from-date="localFilters.fromDate"
        v-model:to-date="localFilters.toDate"
        :presets="datePresets"
        :error-message="dateError"
        :help-text="$t('filters.dateRangeHelp')"
        @change="handleDateChange"
      />

      <div class="flex gap-4 mt-6">
        <Button type="submit" variant="primary" :loading="loading">
          {{ $t('filters.applyFilters') }}
        </Button>
        <Button type="button" variant="secondary" @click="handleReset">
          {{ $t('filters.reset') }}
        </Button>
      </div>
    </form>
  </Card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { VolumeQueryFiltersDto } from '@incur-data/dtos';
import { Card, Button, DateRangePicker } from '@incur-data/ui';
import { getDatePresets } from '~/composables/useApiShared';

export interface DashboardFiltersProps {
  filters: VolumeQueryFiltersDto;
  loading?: boolean;
}

const props = withDefaults(defineProps<DashboardFiltersProps>(), {
  loading: false,
});

const emit = defineEmits<{
  'update:filters': [filters: VolumeQueryFiltersDto];
  apply: [filters: VolumeQueryFiltersDto];
}>();

const { t } = useI18n();

// Local state for form
const localFilters = ref<VolumeQueryFiltersDto>({ ...props.filters });
const dateError = ref<string | null>(null);

// Date presets
const datePresets = getDatePresets();

// Watch props changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });

// Validate date range
const validateDateRange = () => {
  if (!localFilters.value.fromDate || !localFilters.value.toDate) {
    dateError.value = null;
    return true;
  }

  const from = new Date(localFilters.value.fromDate);
  const to = new Date(localFilters.value.toDate);

  if (from > to) {
    dateError.value = t('filters.dateError.startBeforeEnd');
    return false;
  }

  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 365) {
    dateError.value = t('filters.dateError.maxRange');
    return false;
  }

  dateError.value = null;
  return true;
};

const handleDateChange = () => {
  validateDateRange();
};

const handleApply = () => {
  if (!validateDateRange()) {
    return;
  }

  // Clean up empty values and keep only date filters
  const cleanedFilters: VolumeQueryFiltersDto = {};
  if (localFilters.value.fromDate) {
    cleanedFilters.fromDate = localFilters.value.fromDate;
  }
  if (localFilters.value.toDate) {
    cleanedFilters.toDate = localFilters.value.toDate;
  }

  emit('update:filters', cleanedFilters);
  emit('apply', cleanedFilters);
};

const handleReset = () => {
  const defaultFilters: VolumeQueryFiltersDto = {
    fromDate: datePresets[1].fromDate, // Last 30 days
    toDate: datePresets[1].toDate,
  };
  
  localFilters.value = { ...defaultFilters };
  dateError.value = null;
  
  emit('update:filters', defaultFilters);
  emit('apply', defaultFilters);
};
</script>
