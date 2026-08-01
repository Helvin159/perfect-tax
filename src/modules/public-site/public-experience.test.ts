import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PublicServicesV1 } from '@/modules/content/domain/public-services';
import {
  fallbackContactSettings,
  fallbackHomepageContent,
  fallbackPortalSettings,
} from '@/modules/settings/domain/public-settings';

import { AvailabilityPlaceholder } from './presentation/availability-placeholder';
import { Homepage } from './presentation/homepage';

function emptyServices(locale: 'en' | 'es'): PublicServicesV1 {
  return { items: [], locale, schemaVersion: 1 };
}

function renderHomepage(locale: 'en' | 'es'): string {
  return renderToStaticMarkup(
    createElement(Homepage, {
      contact: fallbackContactSettings(locale),
      content: fallbackHomepageContent(locale),
      locale,
      services: emptyServices(locale),
    }),
  );
}

describe('bilingual homepage equivalence', () => {
  it('renders equal semantic sections and service functionality in English and Spanish', () => {
    const english = renderHomepage('en');
    const spanish = renderHomepage('es');

    expect(english.match(/<section/g)).toHaveLength(6);
    expect(spanish.match(/<section/g)).toHaveLength(6);
    expect(english.match(/class="service-card"/g)).toHaveLength(4);
    expect(spanish.match(/class="service-card"/g)).toHaveLength(4);
    expect(english).toContain('aria-labelledby="services-heading"');
    expect(spanish).toContain('aria-labelledby="services-heading"');
    expect(english).toContain('<article class="homepage">');
    expect(spanish).toContain('<article class="homepage">');
  });

  it('contains no contact form or sensitive-data collection controls', () => {
    const html = `${renderHomepage('en')}${renderHomepage('es')}`;

    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('appointment');
  });

  it('renders allowlisted DTO fields without serializing raw CMS metadata', () => {
    const services = {
      items: [
        {
          displayOrder: 1,
          key: 'approved',
          summary: 'Approved summary',
          title: 'Approved service',
          internalNotes: 'LEAK-ME-NOT',
          translationWorkflow: { en: { reviewNotes: 'LEAK-ME-NOT' } },
        },
      ],
      locale: 'en',
      schemaVersion: 1,
    } as unknown as PublicServicesV1;
    const html = renderToStaticMarkup(
      createElement(Homepage, {
        contact: fallbackContactSettings('en'),
        content: fallbackHomepageContent('en'),
        locale: 'en',
        services,
      }),
    );

    expect(html).toContain('Approved service');
    expect(html).not.toMatch(/LEAK-ME-NOT|translationWorkflow|reviewNotes/);
  });
});

describe('safe placeholder surfaces', () => {
  it.each([
    ['en', 'sign-in', 'Online sign-in is not available yet'],
    ['es', 'sign-in', 'El inicio de sesión en línea aún no está disponible'],
    ['en', 'portal', 'Online account access is not available yet'],
    ['es', 'portal', 'El acceso a cuentas en línea aún no está disponible'],
  ] as const)('localizes the %s %s placeholder', (locale, surface, heading) => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityPlaceholder, {
        contact: fallbackContactSettings(locale),
        locale,
        portal: fallbackPortalSettings(locale),
        surface,
      }),
    );

    expect(html).toContain(heading);
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('type="password"');
    expect(html).toContain('role="status"');
  });
});
