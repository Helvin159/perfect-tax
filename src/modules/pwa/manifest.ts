import type { MetadataRoute } from 'next';

import { getServerEnvironment } from '@/config/env/server';
import { type Locale } from '@/modules/localization/locales';
import { getPublicSiteCopy } from '@/modules/public-site/copy';
import type { PublicBusinessIdentityV1 } from '@/modules/settings/domain/public-settings';
import { getPublicBusinessIdentity } from '@/modules/settings/public';

import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from './constants';

const INTERNAL_MANIFEST_ID = 'client-services-portal';

export function buildWebManifest(
  args: Readonly<{
    identity: PublicBusinessIdentityV1;
    locale: Locale;
    siteUrl: string;
  }>,
): MetadataRoute.Manifest {
  const copy = getPublicSiteCopy(args.locale);

  return {
    id: INTERNAL_MANIFEST_ID,
    name: args.identity.displayName,
    short_name: args.identity.shortName ?? args.identity.displayName,
    description: args.identity.description ?? copy.hero.body,
    start_url: new URL(`/${args.locale}`, args.siteUrl).href,
    scope: new URL('/', args.siteUrl).href,
    lang: args.locale,
    display: 'standalone',
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      {
        src: '/app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/app-icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

export async function getWebManifest(locale: Locale) {
  return buildWebManifest({
    identity: await getPublicBusinessIdentity(locale),
    locale,
    siteUrl: getServerEnvironment().SITE_URL,
  });
}
