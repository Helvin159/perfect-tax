import { NextResponse } from 'next/server';

import { getSupportedLocale } from '@/modules/localization/locales';
import { getWebManifest } from '@/modules/pwa/manifest';

type ManifestRouteProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function GET(_request: Request, { params }: ManifestRouteProps) {
  const locale = getSupportedLocale((await params).locale);

  if (!locale) {
    return NextResponse.json(
      { status: 'unavailable' },
      { headers: { 'Cache-Control': 'no-store' }, status: 404 },
    );
  }

  return NextResponse.json(await getWebManifest(locale), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'application/manifest+json',
    },
  });
}
