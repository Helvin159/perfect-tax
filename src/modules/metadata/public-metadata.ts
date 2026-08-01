import type { Metadata } from 'next';

import { getServerEnvironment } from '@/config/env/server';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/modules/localization/locales';
import { getPublicSiteCopy } from '@/modules/public-site/copy';
import {
  getPublicBusinessIdentity,
  getPublicHomepageContent,
} from '@/modules/settings/public';
import type { PublicBusinessIdentityV1 } from '@/modules/settings/domain/public-settings';

type PublicMetadataPage =
  'accessibility' | 'home' | 'portal' | 'privacy' | 'sign-in' | 'terms';

const OPEN_GRAPH_LOCALES = {
  en: 'en_US',
  es: 'es_ES',
} as const satisfies Record<Locale, string>;

const PAGE_PATHS = {
  accessibility: '/accessibility',
  home: '',
  portal: '/portal',
  privacy: '/privacy',
  'sign-in': '/sign-in',
  terms: '/terms',
} as const satisfies Record<PublicMetadataPage, string>;

const PAGE_COPY = {
  en: {
    accessibility: {
      title: 'Accessibility statement',
      description: 'Accessibility information for the public website.',
    },
    portal: {
      title: 'Client portal',
      description:
        'Current availability information for planned online client services.',
    },
    privacy: {
      title: 'Privacy notice',
      description:
        'Privacy notice placeholder for approved public policy content.',
    },
    'sign-in': {
      title: 'Sign in',
      description:
        'Current sign-in availability information for the planned client portal.',
    },
    terms: {
      title: 'Terms of use',
      description:
        'Terms of use placeholder for approved public policy content.',
    },
  },
  es: {
    accessibility: {
      title: 'Declaración de accesibilidad',
      description: 'Información de accesibilidad para el sitio web público.',
    },
    portal: {
      title: 'Portal del cliente',
      description:
        'Información actual sobre la disponibilidad de los servicios en línea planificados para clientes.',
    },
    privacy: {
      title: 'Aviso de privacidad',
      description:
        'Marcador de posición del aviso de privacidad para contenido público aprobado.',
    },
    'sign-in': {
      title: 'Iniciar sesión',
      description:
        'Información actual sobre la disponibilidad del inicio de sesión para el portal del cliente planificado.',
    },
    terms: {
      title: 'Términos de uso',
      description:
        'Marcador de posición de los términos de uso para contenido público aprobado.',
    },
  },
} as const satisfies Record<
  Locale,
  Record<
    Exclude<PublicMetadataPage, 'home'>,
    { title: string; description: string }
  >
>;

function pathFor(locale: Locale, page: PublicMetadataPage): string {
  return `/${locale}${PAGE_PATHS[page]}`;
}

function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).href;
}

function pageTitle(title: string, identity: PublicBusinessIdentityV1): string {
  return `${title} | ${identity.displayName}`;
}

export function buildPublicPageMetadata(
  args: Readonly<{
    identity: PublicBusinessIdentityV1;
    locale: Locale;
    page: PublicMetadataPage;
    siteUrl: string;
    title: string;
    description: string;
  }>,
): Metadata {
  const canonicalPath = pathFor(args.locale, args.page);
  const canonical = absoluteUrl(args.siteUrl, canonicalPath);
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      absoluteUrl(args.siteUrl, pathFor(locale, args.page)),
    ]),
  ) as Record<Locale, string>;
  const title =
    args.page === 'home' ? args.title : pageTitle(args.title, args.identity);

  return {
    title,
    description: args.description,
    alternates: {
      canonical,
      languages: {
        ...languages,
        'x-default': languages[DEFAULT_LOCALE],
      },
    },
    applicationName: args.identity.displayName,
    manifest: absoluteUrl(args.siteUrl, `/${args.locale}/manifest.webmanifest`),
    openGraph: {
      title,
      description: args.description,
      url: canonical,
      siteName: args.identity.displayName,
      locale: OPEN_GRAPH_LOCALES[args.locale],
      alternateLocale: SUPPORTED_LOCALES.filter(
        (locale) => locale !== args.locale,
      ).map((locale) => OPEN_GRAPH_LOCALES[locale]),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description: args.description,
    },
  };
}

export async function getPublicPageMetadata(
  locale: Locale,
  page: Exclude<PublicMetadataPage, 'home'>,
): Promise<Metadata> {
  const identity = await getPublicBusinessIdentity(locale);
  const copy = PAGE_COPY[locale][page];

  return buildPublicPageMetadata({
    identity,
    locale,
    page,
    siteUrl: getServerEnvironment().SITE_URL,
    title: copy.title,
    description: copy.description,
  });
}

export async function getHomepageMetadata(locale: Locale): Promise<Metadata> {
  const [identity, homepageContent] = await Promise.all([
    getPublicBusinessIdentity(locale),
    getPublicHomepageContent(locale),
  ]);
  const fallbackCopy = getPublicSiteCopy(locale);
  const title =
    homepageContent.hero?.heading ??
    identity.tagline ??
    fallbackCopy.hero.heading;
  const description =
    identity.description ??
    homepageContent.hero?.body ??
    fallbackCopy.hero.body;

  return buildPublicPageMetadata({
    identity,
    locale,
    page: 'home',
    siteUrl: getServerEnvironment().SITE_URL,
    title: pageTitle(title, identity),
    description,
  });
}
