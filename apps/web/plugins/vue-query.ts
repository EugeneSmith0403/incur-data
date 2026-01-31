import type { DehydratedState, VueQueryPluginOptions } from '@tanstack/vue-query'
import { VueQueryPlugin, QueryClient, hydrate, dehydrate } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxt) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Стратегия кэширования для аналитических данных
        staleTime: 5 * 60 * 1000, // 5 минут - данные считаются свежими
        gcTime: 10 * 60 * 1000, // 10 минут - время хранения в кэше

        // Поведение при взаимодействии с окном
        refetchOnWindowFocus: true, // Обновлять при возврате на вкладку
        refetchOnMount: true, // Обновлять при монтировании компонента
        refetchOnReconnect: true, // Обновлять при восстановлении соединения

        // Retry стратегия
        retry: 2, // Повторить 2 раза при ошибке
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Network mode
        networkMode: 'online', // Запросы только при наличии соединения
      },
    },
  })

  const options: VueQueryPluginOptions = {
    queryClient,
  }

  nuxt.vueApp.use(VueQueryPlugin, options)

  // SSR поддержка (хотя у нас ssr: false, это для будущего)
  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxt.payload.vueQueryState = { toJSON: () => dehydrate(queryClient) }
    })
  }

  if (import.meta.client) {
    nuxt.hooks.hook('app:created', () => {
      const state = nuxt.payload.vueQueryState as DehydratedState | undefined
      if (state) {
        hydrate(queryClient, state)
      }
    })
  }
})
