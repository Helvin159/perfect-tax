import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next-intl/config': fileURLToPath(
        new URL('./src/modules/localization/request.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
