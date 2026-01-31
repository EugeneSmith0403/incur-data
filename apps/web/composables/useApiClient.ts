/**
 * Centralized API client using Nuxt's $fetch
 */
import type { ApiSuccessResponse, ApiErrorResponse } from '@incur-data/dtos'

/**
 * Generic typed API fetch wrapper
 * Handles parameter cleanup and error transformation
 */
export function useApiClient() {
  const config = useRuntimeConfig()

  /**
   * Centralized fetch function with automatic parameter cleanup
   *
   * @param endpoint - API endpoint path (e.g., '/api/v1/analytics/daily-volume')
   * @param params - Query parameters (undefined/null/empty values will be removed)
   * @returns Promise with typed response data
   * @throws Error with descriptive message on API failure
   */
  async function fetchApi<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<T> {
    // Clean up params - remove undefined/null/empty values
    const cleanParams: Record<string, any> = {}
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          cleanParams[key] = value
        }
      })
    }

    try {
      const result = await $fetch<ApiSuccessResponse<T>>(
        `${config.public.apiUrl}${endpoint}`,
        {
          query: cleanParams,
        }
      )

      if (!result.success) {
        throw new Error('API returned unsuccessful response')
      }

      return result.data
    } catch (error: any) {
      // Handle fetch errors
      if (error.data) {
        const errorData = error.data as ApiErrorResponse
        throw new Error(
          errorData.message || errorData.error || `API Error: ${error.statusCode || 'Unknown'}`
        )
      }
      throw error
    }
  }

  return {
    fetchApi,
  }
}
