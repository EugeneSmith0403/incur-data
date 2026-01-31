<template>
  <Card>
    <template #header>
      <h3 class="text-lg font-semibold text-gray-900 m-0">{{ $t('chart.title') }}</h3>
    </template>

    <div v-if="loading" class="min-h-[400px] flex items-center justify-center">
      <Spinner :text="$t('chart.loading')" />
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

    <div v-else>
      <v-chart
        ref="chartRef"
        class="w-full h-[400px]"
        :option="chartOption"
        :loading="loading"
        autoresize
      />
      
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-300">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-600">{{ $t('chart.totalCreated') }}</span>
          <span class="text-2xl font-bold text-gray-900">${{ totalCreatedVolume }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-600">{{ $t('chart.totalFulfilled') }}</span>
          <span class="text-2xl font-bold text-gray-900">${{ totalFulfilledVolume }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-600">{{ $t('chart.fulfillmentRate') }}</span>
          <span class="text-2xl font-bold text-gray-900">{{ fulfillmentRate }}%</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';
import type { EChartsOption } from 'echarts';
import type { DailyVolumeSummaryResultDto } from '@incur-data/dtos';
import { Card, EmptyState, Alert, Button, Spinner } from '@incur-data/ui';

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
]);

export interface VolumeChartProps {
  data: DailyVolumeSummaryResultDto[] | null;
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<VolumeChartProps>(), {
  loading: false,
  error: null,
});

defineEmits<{
  refresh: [];
}>();

const { t } = useI18n();

const chartRef = ref();

// Process data for chart
const chartData = computed(() => {
  if (!props.data || props.data.length === 0) return null;

  return props.data.map(item => ({
    date: item.date,
    created: parseFloat(item.createdVolumeUsd),
    fulfilled: parseFloat(item.fulfilledVolumeUsd),
    createdCount: item.createdCount,
    fulfilledCount: item.fulfilledCount,
    fulfillmentRate: item.fulfillmentRate.toFixed(2), // Already a percentage (0-100)
  }));
});

// Calculate summary metrics
const totalCreatedVolume = computed(() => {
  if (!chartData.value) return '0';
  const total = chartData.value.reduce((sum, item) => sum + item.created, 0);
  return total.toLocaleString('en-US', { maximumFractionDigits: 2 });
});

const totalFulfilledVolume = computed(() => {
  if (!chartData.value) return '0';
  const total = chartData.value.reduce((sum, item) => sum + item.fulfilled, 0);
  return total.toLocaleString('en-US', { maximumFractionDigits: 2 });
});

const fulfillmentRate = computed(() => {
  if (!chartData.value || chartData.value.length === 0) return '0.00';
  const created = chartData.value.reduce((sum, item) => sum + item.created, 0);
  const fulfilled = chartData.value.reduce((sum, item) => sum + item.fulfilled, 0);
  if (created === 0) return '0.00';
  return ((fulfilled / created) * 100).toFixed(2);
});

// ECharts configuration
const chartOption = computed<EChartsOption>(() => {
  if (!chartData.value) return {};

  const dates = chartData.value.map(item => item.date);
  const createdValues = chartData.value.map(item => item.created);
  const fulfilledValues = chartData.value.map(item => item.fulfilled);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex;
        const item = chartData.value![dataIndex];
        return `
          <div style="font-weight: 600; margin-bottom: 8px;">${item.date}</div>
          <div style="color: #3b82f6;">● ${t('chart.created')}: $${item.created.toLocaleString()}</div>
          <div style="color: #10b981;">● ${t('chart.fulfilled')}: $${item.fulfilled.toLocaleString()}</div>
          <div style="margin-top: 8px;">
            <div>${t('chart.createdOrders')} ${item.createdCount}</div>
            <div>${t('chart.fulfilledOrders')} ${item.fulfilledCount}</div>
            <div>${t('chart.fulfillmentRate')} ${item.fulfillmentRate}%</div>
          </div>
        `;
      },
    },
    legend: {
      data: [t('chart.createdVolume'), t('chart.fulfilledVolume')],
      top: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `$${(value / 1000).toFixed(0)}K`,
      },
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        start: 0,
        end: 100,
      },
    ],
    series: [
      {
        name: t('chart.createdVolume'),
        type: 'line',
        data: createdValues,
        smooth: true,
        lineStyle: {
          color: '#3b82f6',
          width: 3,
        },
        itemStyle: {
          color: '#3b82f6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
            ],
          },
        },
      },
      {
        name: t('chart.fulfilledVolume'),
        type: 'line',
        data: fulfilledValues,
        smooth: true,
        lineStyle: {
          color: '#10b981',
          width: 3,
        },
        itemStyle: {
          color: '#10b981',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
            ],
          },
        },
      },
    ],
  };
});
</script>
