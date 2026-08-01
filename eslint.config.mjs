import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['src/modules/cms/migrations/20*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts']),
]);
