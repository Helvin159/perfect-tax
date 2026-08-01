import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/config/env/server', () => ({
  getServerEnvironment: () => ({
    DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
    PAYLOAD_SECRET: 'test-secret-that-is-long-enough-for-runtime',
    SITE_URL: 'https://example.com',
  }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: 'en' | 'es';
    namespace: 'LocalePlaceholder';
  }) => {
    const { loadMessages } = await import('./messages');
    const messages = await loadMessages(locale);

    return (key: keyof (typeof messages)[typeof namespace]) =>
      messages[namespace][key];
  },
  setRequestLocale: vi.fn(),
}));

vi.mock('@/modules/settings/public', () => ({
  getPublicBusinessIdentity: async (locale: 'en' | 'es') => ({
    displayName: 'Configured Public Name',
    locale,
    schemaVersion: 1,
  }),
  getPublicContactSettings: async (locale: 'en' | 'es') => ({
    locale,
    schemaVersion: 1,
  }),
  getPublicHomepageContent: async (locale: 'en' | 'es') => ({
    locale,
    schemaVersion: 1,
  }),
  getPublicPortalSettings: async (locale: 'en' | 'es') => ({
    availability: 'unavailable',
    locale,
    schemaVersion: 1,
  }),
}));

vi.mock('@/modules/content/public', () => ({
  getPublicServices: async (locale: 'en' | 'es') => ({
    items: [],
    locale,
    schemaVersion: 1,
  }),
}));

import LocalePage from '@/app/[locale]/(marketing)/page';
import SignInPage from '@/app/[locale]/(auth)/sign-in/page';
import PortalPage from '@/app/[locale]/(portal)/portal/page';
import PrivacyPage from '@/app/[locale]/(marketing)/privacy/page';
import TermsPage from '@/app/[locale]/(marketing)/terms/page';
import AccessibilityPage from '@/app/[locale]/(marketing)/accessibility/page';

describe('localized placeholder routes', () => {
  it.each([
    [
      'en',
      'Clear support for important paperwork and tax needs',
      'Services designed around clear next steps',
    ],
    [
      'es',
      'Apoyo claro para trámites importantes y necesidades tributarias',
      'Servicios orientados a próximos pasos claros',
    ],
  ] as const)('renders the /%s homepage', async (locale, title, copy) => {
    const page = await LocalePage({
      params: Promise.resolve({ locale }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain(title);
    expect(html).toContain(copy);
  });
});

describe('placeholder auth routes', () => {
  it.each([
    ['en', 'Online sign-in is not available yet'],
    ['es', 'El inicio de sesión en línea aún no está disponible'],
  ] as const)('renders the /%s/sign-in placeholder', async (locale, title) => {
    const page = await SignInPage({ params: Promise.resolve({ locale }) });
    expect(renderToStaticMarkup(page)).toContain(title);
  });
});

describe('placeholder portal routes', () => {
  it.each([
    ['en', 'Online account access is not available yet'],
    ['es', 'El acceso a cuentas en línea aún no está disponible'],
  ] as const)('renders the /%s/portal placeholder', async (locale, title) => {
    const page = await PortalPage({ params: Promise.resolve({ locale }) });
    expect(renderToStaticMarkup(page)).toContain(title);
  });
});

describe('localized legal placeholder routes', () => {
  it.each([
    [PrivacyPage, 'en', 'Privacy notice'],
    [PrivacyPage, 'es', 'Aviso de privacidad'],
    [TermsPage, 'en', 'Terms of use'],
    [TermsPage, 'es', 'Términos de uso'],
    [AccessibilityPage, 'en', 'Accessibility statement'],
    [AccessibilityPage, 'es', 'Declaración de accesibilidad'],
  ] as const)(
    'renders approved-status placeholder copy',
    async (Page, locale, title) => {
      const page = await Page({ params: Promise.resolve({ locale }) });
      const html = renderToStaticMarkup(page);

      expect(html).toContain(title);
      expect(html).toMatch(
        /not a finalized policy|no es una política finalizada/,
      );
    },
  );
});
