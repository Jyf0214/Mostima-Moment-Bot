import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/lib/**/*.ts', 'src/pages/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/i18n/**', '**/*.d.ts'],
      // [BUILDER-C-AUD-C-001] 最低覆盖率门槛：CI 中 test:coverage 会强制执行，应随测试增长逐步提高
      thresholds: {
        lines: 29,
        functions: 46,
        branches: 34,
        statements: 29,
      },
    },
    testTimeout: 30000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
