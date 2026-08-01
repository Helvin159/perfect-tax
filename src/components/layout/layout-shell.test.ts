import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/portal',
  useSearchParams: () =>
    new URLSearchParams('ref=campaign&token=must-not-cross'),
}));

const {
  getPublicBusinessIdentity,
  getPublicContactSettings,
  getPublicHomepageContent,
} = vi.hoisted(() => ({
  getPublicBusinessIdentity: vi.fn(),
  getPublicContactSettings: vi.fn(),
  getPublicHomepageContent: vi.fn(),
}));

vi.mock('@/modules/settings/public', () => ({
  getPublicBusinessIdentity,
  getPublicContactSettings,
  getPublicHomepageContent,
}));

import { SharedShell } from './shared-shell';
import { SiteHeader } from './site-header';
import { LanguageSwitcher } from '@/modules/localization/presentation/language-switcher';
import { getShellCopy } from '@/modules/localization/shell-copy';
import {
  fallbackBusinessIdentity,
  fallbackContactSettings,
  fallbackHomepageContent,
} from '@/modules/settings/domain/public-settings';

describe('language switcher accessibility', () => {
  it('renders named, native keyboard-operable language links with text labels', () => {
    const html = renderToStaticMarkup(
      createElement(LanguageSwitcher, {
        accessibleName: 'Language',
        currentLocale: 'en',
        unsavedStateWarning: 'Discard unsaved changes?',
      }),
    );

    expect(html).toContain('aria-label="Language"');
    expect(html).toContain('English');
    expect(html).toContain('Español');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('path=%2Fes%2Fportal%3Fref%3Dcampaign');
    expect(html).not.toContain('must-not-cross');
    expect(html).not.toContain('<select');
  });
});

describe('responsive site navigation', () => {
  it('uses a named nav and native details/summary mobile disclosure', () => {
    const html = renderToStaticMarkup(
      createElement(SiteHeader, {
        contact: fallbackContactSettings('en'),
        copy: getShellCopy('en'),
        identity: fallbackBusinessIdentity('en'),
        locale: 'en',
        surface: 'public',
      }),
    );

    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).toContain('<details class="mobile-navigation">');
    expect(html).toContain('<summary>Open navigation menu</summary>');
    expect(html).toContain('Sign in (coming soon)');
  });
});

describe('shared surface shells', () => {
  beforeEach(() => {
    getPublicBusinessIdentity.mockResolvedValue(fallbackBusinessIdentity('en'));
    getPublicContactSettings.mockResolvedValue(fallbackContactSettings('en'));
    getPublicHomepageContent.mockResolvedValue(fallbackHomepageContent('en'));
  });

  it.each(['public', 'auth', 'portal'] as const)(
    'renders the accessible %s shell with centralized identity fallback',
    async (surface) => {
      const shell = await SharedShell({
        children: createElement('p', null, `${surface} content`),
        locale: 'en',
        surface,
      });
      const html = renderToStaticMarkup(shell);

      expect(html).toContain(`app-shell-${surface}`);
      expect(html).toContain('Skip to main content');
      expect(html).toContain('<header');
      expect(html).toContain('<main');
      expect(html).toContain('<footer');
      expect(html).toContain('Perfect Tax');
      expect(html).toContain(`${surface} content`);
    },
  );
});
