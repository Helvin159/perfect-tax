import config from '@payload-config';
import { generatePageMetadata, RootPage } from '@payloadcms/next/views';

import { importMap } from '../importMap.js';

type AdminPageProps = Readonly<{
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
}>;

export const generateMetadata = ({ params, searchParams }: AdminPageProps) =>
  generatePageMetadata({ config, params, searchParams });

export default function AdminPage({ params, searchParams }: AdminPageProps) {
  return RootPage({ config, importMap, params, searchParams });
}
