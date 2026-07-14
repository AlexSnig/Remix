import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/utils/settings.ts',
        'src/utils/motionDetection.ts',
        'src/utils/indexedDB.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 88,
        statements: 90,
        branches: 84,
      },
    },
  },
});
