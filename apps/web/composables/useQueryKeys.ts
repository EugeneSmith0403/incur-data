/**
 * Centralized query keys factory for TanStack Query
 * Следует best practices:
 * - Иерархическая структура ключей
 * - Детерминированное кэширование
 * - Простая инвалидация групп запросов
 */
import { useQueryClient } from '@tanstack/vue-query'
import type { VolumeQueryFiltersDto } from '@incur-data/dtos'

/**
 * Hierarchical query keys structure
 * Example usage:
 * - queryKeys.analytics.all - invalidates all analytics queries
 * - queryKeys.analytics.dailyVolume(filters) - specific query with filters
 */
export const queryKeys = {
  analytics: {
    all: ['analytics'] as const,
    dailyVolume: (filters: VolumeQueryFiltersDto) =>
      [...queryKeys.analytics.all, 'daily-volume', filters] as const,
    dailyVolumeSummary: (filters: VolumeQueryFiltersDto) =>
      [...queryKeys.analytics.all, 'daily-volume-summary', filters] as const,
    totalStats: () =>
      [...queryKeys.analytics.all, 'total-stats'] as const,
  },
} as const

/**
 * Helper для инвалидации всех analytics запросов
 * Использование: invalidateAnalytics()
 */
export function useInvalidateAnalytics() {
  const queryClient = useQueryClient()

  return () => queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
}
