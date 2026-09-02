import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@payload-config': fileURLToPath(
        new URL('./payload.config.ts', import.meta.url),
      ),
      'next-intl/config': fileURLToPath(
        new URL('./src/modules/localization/request.ts', import.meta.url),
      ),
    },
  },
  test: {
    fileParallelism: false,
    hookTimeout: 120_000,
    include: ['integration/**/*.integration.test.ts'],
    maxWorkers: 1,
    setupFiles: ['src/modules/authorization/infrastructure/vitest.setup.ts'],
    testTimeout: 120_000,
  },
});
