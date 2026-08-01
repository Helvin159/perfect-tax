import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withPayload } from '@payloadcms/next/withPayload';

const withNextIntl = createNextIntlPlugin(
  './src/modules/localization/request.ts',
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default withPayload(withNextIntl(nextConfig));
