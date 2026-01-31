<template>
  <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
    <header class="bg-white border-b border-gray-300 py-8 mb-8">
      <div class="max-w-[1400px] mx-auto px-6 flex justify-between items-center gap-8 flex-wrap">
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('app.title') }}</h1>
          <p class="text-base text-gray-600">{{ $t('app.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-4">
          <LanguageSwitcher />
        </div>
      </div>
    </header>

    <div class="max-w-[1400px] mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
      <!-- Filters Section -->
      <aside class="lg:self-start">
        <DashboardFilters
          :filters="filters"
          :loading="volumeData.loading.value || totalStatsData.loading.value"
          @apply="handleFiltersApply"
        />
      </aside>

      <!-- Main Content Section -->
      <main class="min-w-0">
        <!-- Loading State -->
        <div v-if="isInitialLoad" class="flex items-center justify-center min-h-[400px]">
          <Spinner size="3rem" :text="$t('common.loading')" />
        </div>

        <!-- Error State -->
        <Alert v-else-if="globalError" variant="danger" class="mb-8">
          <strong>{{ $t('common.error') }}</strong> {{ globalError }}
          <Button variant="secondary" size="sm" @click="handleRefresh" class="mt-4">
            {{ $t('common.retry') }}
          </Button>
        </Alert>

        <!-- Dashboard Content -->
        <div v-else class="flex flex-col gap-8">
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card>
              <div class="flex gap-4 items-start">
                <div class="w-12 h-12 rounded-md bg-primary-100 text-primary-500 flex items-center justify-center flex-shrink-0">
                  <CurrencyDollarIcon class="w-7 h-7" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-600 mb-1">{{ $t('stats.totalVolume') }}</div>
                  <div class="text-3xl font-bold text-gray-900 leading-tight mb-1">${{ totalVolume }}</div>
                  <div class="text-xs text-gray-500">{{ $t('stats.totalVolumeDesc') }}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div class="flex gap-4 items-start">
                <div class="w-12 h-12 rounded-md bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircleIcon class="w-7 h-7" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-600 mb-1">{{ $t('stats.totalOrders') }}</div>
                  <div class="text-3xl font-bold text-gray-900 leading-tight mb-1">{{ totalOrders }}</div>
                  <div class="text-xs text-gray-500">{{ dataPointsCount }} {{ $t('stats.dataPoints') }}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div class="flex gap-4 items-start">
                <div class="w-12 h-12 rounded-md bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0">
                  <ChartBarIcon class="w-7 h-7" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-600 mb-1">{{ $t('stats.avgOrderSize') }}</div>
                  <div class="text-3xl font-bold text-gray-900 leading-tight mb-1">${{ avgOrderSize }}</div>
                  <div class="text-xs text-gray-500">{{ $t('stats.perOrder') }}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div class="flex gap-4 items-start">
                <div class="w-12 h-12 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <ClockIcon class="w-7 h-7" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-600 mb-1">{{ $t('stats.dateRange') }}</div>
                  <div class="text-3xl font-bold text-gray-900 leading-tight mb-1">{{ dateRangeDays }}</div>
                  <div class="text-xs text-gray-500">{{ $t('stats.days') }}</div>
                </div>
              </div>
            </Card>
          </div>

          <!-- Volume Chart -->
          <VolumeChart
            :data="volumeData.data.value"
            :loading="volumeData.loading.value"
            :error="volumeData.error.value"
            @refresh="handleRefresh"
          />

          <!-- Volume Table -->
          <VolumeTable
            :data="volumeData.data.value"
            :loading="volumeData.loading.value"
            :error="volumeData.error.value"
            @refresh="handleRefresh"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { VolumeQueryFiltersDto } from '@incur-data/dtos';
import { Card, Alert, Button, Spinner } from '@incur-data/ui';
import { 
  CurrencyDollarIcon, 
  CheckCircleIcon, 
  ChartBarIcon, 
  ClockIcon 
} from '@heroicons/vue/24/outline';
import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
import DashboardFilters from '~/components/dashboard/DashboardFilters.vue';
import VolumeChart from '~/components/dashboard/VolumeChart.vue';
import VolumeTable from '~/components/dashboard/VolumeTable.vue';
import { useDailyVolumeSummary, useTotalStats } from '~/composables/useAnalyticsApi';
import { getDatePresets } from '~/composables/useApiShared';

const { t } = useI18n();

// SEO
useHead({
  title: computed(() => `${t('app.title')} | DLN Indexer`),
  meta: [
    { name: 'description', content: computed(() => t('app.subtitle')) },
  ],
});

// Initial filters - default to last 30 days
const datePresets = getDatePresets();
const filters = ref<VolumeQueryFiltersDto>({
  fromDate: datePresets[1].fromDate,
  toDate: datePresets[1].toDate,
});

// Polling interval - 30 seconds
const POLLING_INTERVAL = 30 * 1000;

// API data management with polling (continues even when tab is inactive)
const volumeData = useDailyVolumeSummary(filters, {
  refetchInterval: POLLING_INTERVAL,
  refetchIntervalInBackground: true
});
const totalStatsData = useTotalStats({
  refetchInterval: POLLING_INTERVAL,
  refetchIntervalInBackground: true
});
const isInitialLoad = ref(true);
const globalError = ref<string | null>(null);

// Computed statistics from total stats (all time)
const totalVolume = computed(() => {
  if (!totalStatsData.data.value) return '0';

  const createdVol = parseFloat(totalStatsData.data.value.created.totalVolumeUsd);
  const fulfilledVol = parseFloat(totalStatsData.data.value.fulfilled.totalVolumeUsd);
  const total = createdVol + fulfilledVol;

  return total.toLocaleString('en-US', { maximumFractionDigits: 2 });
});

const totalOrders = computed(() => {
  if (!totalStatsData.data.value) return '0';

  const total = totalStatsData.data.value.created.orderCount +
                totalStatsData.data.value.fulfilled.orderCount;

  return total.toLocaleString('en-US');
});

const avgOrderSize = computed(() => {
  if (!totalStatsData.data.value) return '0';

  const createdVol = parseFloat(totalStatsData.data.value.created.totalVolumeUsd);
  const fulfilledVol = parseFloat(totalStatsData.data.value.fulfilled.totalVolumeUsd);
  const totalVol = createdVol + fulfilledVol;

  const totalCount = totalStatsData.data.value.created.orderCount +
                     totalStatsData.data.value.fulfilled.orderCount;

  if (totalCount === 0) return '0';

  return (totalVol / totalCount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
});

const dataPointsCount = computed(() => {
  return volumeData.data.value?.length || 0;
});

const dateRangeDays = computed(() => {
  if (!totalStatsData.data.value) return '0';

  const dateRange = totalStatsData.data.value.dateRange;
  if (!dateRange || !dateRange.from || !dateRange.to) return '0';

  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);

  // Проверка на валидность дат
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return '0';

  const diffTime = Math.abs(to.getTime() - from.getTime());
  // +1 потому что данные включают оба дня (от X до X = 1 день)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays.toLocaleString('en-US');
});

// Event handlers
const handleFiltersApply = async (newFilters: VolumeQueryFiltersDto) => {
  filters.value = { ...newFilters };
  globalError.value = null;
  
  try {
    await volumeData.execute();
  } catch (e) {
    globalError.value = e instanceof Error ? e.message : 'Failed to load data';
  }
};

const handleRefresh = async () => {
  globalError.value = null;

  try {
    await Promise.all([
      volumeData.refresh(),
      totalStatsData.refresh()
    ]);
  } catch (e) {
    globalError.value = e instanceof Error ? e.message : 'Failed to refresh data';
  }
};

// Initial data load
onMounted(async () => {
  try {
    await Promise.all([
      volumeData.execute(),
      totalStatsData.execute()
    ]);
  } catch (e) {
    globalError.value = e instanceof Error ? e.message : 'Failed to load initial data';
  } finally {
    isInitialLoad.value = false;
  }
});
</script>
