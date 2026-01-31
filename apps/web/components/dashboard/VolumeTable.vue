<template>
  <Card>
    <template #header>
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-900 m-0">{{ $t('table.title') }}</h3>
        <Button variant="ghost" size="sm" @click="handleExport">
          {{ $t('table.exportCsv') }}
        </Button>
      </div>
    </template>

    <div v-if="loading" class="min-h-[300px] flex items-center justify-center">
      <Spinner :text="$t('table.loading')" />
    </div>

    <EmptyState
      v-else-if="!data || data.length === 0"
      :title="$t('common.noData')"
      :description="$t('common.noDataDesc')"
    >
      <Button variant="secondary" size="sm" @click="$emit('refresh')">
        {{ $t('common.refreshData') }}
      </Button>
    </EmptyState>

    <Alert v-else-if="error" variant="danger">
      {{ error }}
    </Alert>

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead class="bg-gray-50 border-b-2 border-gray-300">
          <tr>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('date')"
            >
              {{ $t('table.headers.date') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('date') }}</span>
            </th>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('createdVolumeUsd')"
            >
              {{ $t('table.headers.createdVolume') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('createdVolumeUsd') }}</span>
            </th>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('createdCount')"
            >
              {{ $t('table.headers.createdOrders') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('createdCount') }}</span>
            </th>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('fulfilledVolumeUsd')"
            >
              {{ $t('table.headers.fulfilledVolume') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('fulfilledVolumeUsd') }}</span>
            </th>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('fulfilledCount')"
            >
              {{ $t('table.headers.fulfilledOrders') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('fulfilledCount') }}</span>
            </th>
            <th 
              class="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100"
              @click="sortBy('fulfillmentRate')"
            >
              {{ $t('table.headers.fulfillmentRate') }}
              <span class="ml-1 text-primary-500">{{ getSortIndicator('fulfillmentRate') }}</span>
            </th>
            <th class="px-4 py-3 text-left font-semibold text-gray-700">{{ $t('table.headers.chainRoute') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="row in sortedData" 
            :key="`${row.date}-${row.giveChainId}-${row.takeChainId}`"
            class="border-b border-gray-300 hover:bg-gray-50"
          >
            <td class="px-4 py-3 font-medium text-gray-900">{{ formatDate(row.date) }}</td>
            <td class="px-4 py-3 text-right font-mono text-gray-900">${{ formatNumber(row.createdVolumeUsd) }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ row.createdCount.toLocaleString() }}</td>
            <td class="px-4 py-3 text-right font-mono text-gray-900">${{ formatNumber(row.fulfilledVolumeUsd) }}</td>
            <td class="px-4 py-3 text-right text-gray-700">{{ row.fulfilledCount.toLocaleString() }}</td>
            <td class="px-4 py-3 text-center">
              <span
                class="inline-block px-2 py-1 rounded-full text-xs font-semibold"
                :class="getFulfillmentClass(row.fulfillmentRate)"
              >
                {{ row.fulfillmentRate.toFixed(2) }}%
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-[13px] text-gray-600">
              <span v-if="row.giveChainId || row.takeChainId">{{ row.giveChainId }} → {{ row.takeChainId }}</span>
              <span v-else class="text-gray-400">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DailyVolumeSummaryResultDto } from '@incur-data/dtos';
import { Card, EmptyState, Alert, Button, Spinner } from '@incur-data/ui';

export interface VolumeTableProps {
  data: DailyVolumeSummaryResultDto[] | null;
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<VolumeTableProps>(), {
  loading: false,
  error: null,
});

defineEmits<{
  refresh: [];
}>();

const { t } = useI18n();

// Sorting state
const sortColumn = ref<keyof DailyVolumeSummaryResultDto>('date');
const sortDirection = ref<'asc' | 'desc'>('desc');

const sortBy = (column: keyof DailyVolumeSummaryResultDto) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'desc';
  }
};

const getSortIndicator = (column: keyof DailyVolumeSummaryResultDto) => {
  if (sortColumn.value !== column) return '';
  return sortDirection.value === 'asc' ? '↑' : '↓';
};

const sortedData = computed(() => {
  if (!props.data) return [];
  
  const sorted = [...props.data].sort((a, b) => {
    let aVal: any = a[sortColumn.value];
    let bVal: any = b[sortColumn.value];

    // Convert string numbers to actual numbers for comparison
    if (sortColumn.value === 'createdVolumeUsd' || sortColumn.value === 'fulfilledVolumeUsd') {
      aVal = parseFloat(aVal);
      bVal = parseFloat(bVal);
    }

    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
});

// Formatting helpers
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

const formatNumber = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

const getFulfillmentClass = (rate: number) => {
  // rate is already a percentage (0-100)
  if (rate >= 80) return 'bg-green-100 text-green-900';
  if (rate >= 50) return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-900';
};

// Export functionality
const handleExport = () => {
  if (!props.data || props.data.length === 0) return;

  const headers = [
    t('table.headers.date'),
    t('table.headers.createdVolume') + ' (USD)',
    t('table.headers.createdOrders'),
    t('table.headers.fulfilledVolume') + ' (USD)',
    t('table.headers.fulfilledOrders'),
    t('table.headers.fulfillmentRate'),
    t('filters.giveChainId'),
    t('filters.takeChainId'),
  ];

  const rows = props.data.map(row => [
    row.date,
    row.createdVolumeUsd,
    row.createdCount,
    row.fulfilledVolumeUsd,
    row.fulfilledCount,
    row.fulfillmentRate.toFixed(2) + '%', // rate is already a percentage (0-100)
    row.giveChainId || '-',
    row.takeChainId || '-',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `volume-data-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
</script>
