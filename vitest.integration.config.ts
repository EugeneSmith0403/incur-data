import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000, // Longer timeout for integration tests
    hookTimeout: 60000,
    setupFiles: [],
    poolOptions: {
      threads: {
        singleThread: true, // Run integration tests sequentially
      },
    },
  },
});
