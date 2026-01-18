import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/ai-ui-tests/**/*.test.ts'],
    testTimeout: 120000, // 2 min - AI tests may take longer
    hookTimeout: 60000,
    setupFiles: ['./tests/ai-ui-tests/setup.ts'],
    sequence: {
      concurrent: false, // Sequential by default, use sessions for parallel
    },
    maxConcurrency: 1,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
