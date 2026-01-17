import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      PGLITE_DATA_DIR: '',
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.claude'],
    alias: {
      '@/db/client': resolve(__dirname, './src/db/client.ts'),
      '@/services/agent.service': resolve(__dirname, './src/services/agent.service.ts'),
      '@/services/session.service': resolve(__dirname, './src/services/session.service.ts'),
      '@/services/task.service': resolve(__dirname, './src/services/task.service.ts'),
      '@/services/worktree.service': resolve(__dirname, './src/services/worktree.service.ts'),
      '@/services/project.service': resolve(__dirname, './src/services/project.service.ts'),
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.d.ts', 'src/**/types.ts', 'src/**/index.ts'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
