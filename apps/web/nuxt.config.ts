// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-01-01',
  
  devtools: { enabled: true },
  
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_WEB_API_URL || 'http://localhost:3000',
    },
  },

  modules: ['@nuxtjs/i18n'],

  i18n: {
    locales: [
      {
        code: 'en',
        name: 'English',
        file: 'en.json',
      },
      {
        code: 'ru',
        name: 'Русский',
        file: 'ru.json',
      },
      {
        code: 'de',
        name: 'Deutsch',
        file: 'de.json',
      },
    ],
    langDir: 'locales',
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // Disable during build for faster builds
  },

  css: ['~/assets/css/main.css', '@incur-data/ui/dist/style.css'],

  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },

  vite: {
    optimizeDeps: {
      include: ['echarts', 'vue-echarts'],
    },
    server: {
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.nuxt/**',
          '**/.output/**',
          '**/dist/**',
        ],
      },
    },
  },

  ssr: false,

  app: {
    head: {
      title: 'DLN Indexer Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Production-grade indexer for Solana DLN transactions' },
      ],
    },
  },
  devServer: {
    port: process.env.NUXT_PUBLIC_WEB_PORT || "8080"
  }
});
