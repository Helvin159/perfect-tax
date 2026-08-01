import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import type { ReactNode } from 'react';

import { importMap } from './admin/importMap.js';

type PayloadLayoutProps = Readonly<{ children: ReactNode }>;

export const dynamic = 'force-dynamic';

async function serverFunction(
  args: Parameters<typeof handleServerFunctions>[0] extends infer HandlerArgs
    ? Omit<HandlerArgs, 'config' | 'importMap'>
    : never,
) {
  'use server';

  return handleServerFunctions({ ...args, config, importMap });
}

export default function PayloadLayout({ children }: PayloadLayoutProps) {
  return RootLayout({
    children,
    config,
    importMap,
    serverFunction,
  });
}
