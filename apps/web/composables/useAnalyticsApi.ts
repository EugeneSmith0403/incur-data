/**
 * Composable for making typed API calls to analytics endpoints
 * Migrated to TanStack Query for automatic caching and state management
 */
import { computed, unref, type Ref } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import type {
  DailyVolumeResultDto,
  DailyVolumeSummaryResultDto,
  VolumeQueryFiltersDto,
  TotalStatsResultDto,
} from '@incur-data/dtos'
import type { UseApiOptions, ApiState } from './useApiShared'
import { useApiClient } from './useApiClient'
import { queryKeys } from './useQueryKeys'

/**
 * Composable for fetching daily volume data
 * Uses TanStack Query for automatic caching and refetching
 */
export function useDailyVolume(
  filters: Ref<VolumeQueryFiltersDto>,
  options: UseApiOptions = {}
): ApiState<DailyVolumeResultDto[]> {
  const { fetchApi } = useApiClient()
  const queryClient = useQueryClient()

  // Реактивный query key основанный на фильтрах
  const queryKey = computed(() => queryKeys.analytics.dailyVolume(unref(filters)))

  // Query function
  const queryFn = () =>
    fetchApi<DailyVolumeResultDto[]>('/api/v1/analytics/daily-volume', unref(filters))

  // TanStack Query - автоматическое управление состоянием
  const query = useQuery({
    queryKey,
    queryFn,
    enabled: options.immediate !== false, // По умолчанию enabled
  })

  // Адаптация к существующему API интерфейсу для обратной совместимости
  return {
    data: computed(() => query.data.value ?? null),
    loading: computed(() => query.isLoading.value || query.isFetching.value),
    error: computed(() => (query.error.value ? String(query.error.value) : null)),
    execute: async () => {
      await query.refetch()
    },
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: unref(queryKey) })
    },
  }
}

/**
 * Composable for fetching daily volume summary (created vs fulfilled)
 * Uses TanStack Query for automatic caching and refetching
 */
export function useDailyVolumeSummary(
  filters: Ref<VolumeQueryFiltersDto>,
  options: UseApiOptions = {}
): ApiState<DailyVolumeSummaryResultDto[]> {
  const { fetchApi } = useApiClient()
  const queryClient = useQueryClient()

  const queryKey = computed(() => queryKeys.analytics.dailyVolumeSummary(unref(filters)))

  const queryFn = () =>
    fetchApi<DailyVolumeSummaryResultDto[]>(
      '/api/v1/analytics/daily-volume-summary',
      unref(filters)
    )

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: options.immediate !== false,
    refetchInterval: options.refetchInterval,
    refetchIntervalInBackground: options.refetchIntervalInBackground ?? false,
  })

  return {
    data: computed(() => query.data.value ?? null),
    loading: computed(() => query.isLoading.value || query.isFetching.value),
    error: computed(() => (query.error.value ? String(query.error.value) : null)),
    execute: async () => {
      await query.refetch()
    },
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: unref(queryKey) })
    },
  }
}

/**
 * Composable for fetching total statistics (all time)
 * Uses TanStack Query for automatic caching and refetching
 */
export function useTotalStats(
  options: UseApiOptions = {}
): ApiState<TotalStatsResultDto> {
  const { fetchApi } = useApiClient()
  const queryClient = useQueryClient()

  const queryKey = computed(() => queryKeys.analytics.totalStats())

  const queryFn = () => fetchApi<TotalStatsResultDto>('/api/v1/analytics/total-stats', {})

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: options.immediate !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes - total stats don't change frequently
    refetchInterval: options.refetchInterval,
    refetchIntervalInBackground: options.refetchIntervalInBackground ?? false,
  })

  return {
    data: computed(() => query.data.value ?? null),
    loading: computed(() => query.isLoading.value || query.isFetching.value),
    error: computed(() => (query.error.value ? String(query.error.value) : null)),
    execute: async () => {
      await query.refetch()
    },
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: unref(queryKey) })
    },
  }
}
