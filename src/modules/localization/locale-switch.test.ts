import { describe, expect, it, vi } from 'vitest';

import {
  allowlistedLocaleSwitchQuery,
  buildEquivalentLocalePath,
  canContinueLocaleSwitch,
  sanitizeLocaleSwitchDestination,
} from './locale-switch';
import { getExplicitLocalePersistencePlan } from './profile-locale-preference';

describe('locale switch routing', () => {
  it('preserves the equivalent nested route in both directions', () => {
    expect(
      buildEquivalentLocalePath({
        pathname: '/en/portal',
        targetLocale: 'es',
      }),
    ).toBe('/es/portal');
    expect(
      buildEquivalentLocalePath({
        pathname: '/es/sign-in',
        targetLocale: 'en',
      }),
    ).toBe('/en/sign-in');
  });

  it('preserves only allowlisted, constrained attribution values', () => {
    expect(
      buildEquivalentLocalePath({
        pathname: '/en',
        query: 'utm_source=newsletter&utm_campaign=summer-2026&ref=partner_1',
        targetLocale: 'es',
      }),
    ).toBe('/es?ref=partner_1&utm_campaign=summer-2026&utm_source=newsletter');
  });

  it('drops tokens, callbacks, auth state, free text, and unsafe allowlisted values', () => {
    const query = allowlistedLocaleSwitchQuery(
      'token=secret&callbackUrl=https://evil.example&code=abc&state=xyz&q=tax+id&utm_source=https://evil.example&ref=contains%40email',
    );

    expect(query.toString()).toBe('');
  });

  it('falls back safely for unprefixed paths and external redirects', () => {
    expect(
      buildEquivalentLocalePath({ pathname: '/portal', targetLocale: 'es' }),
    ).toBe('/es');
    expect(
      sanitizeLocaleSwitchDestination('https://evil.example/es', 'es'),
    ).toBe('/es');
  });

  it('revalidates locale and query parameters at the redirect boundary', () => {
    expect(
      sanitizeLocaleSwitchDestination(
        '/es/portal?ref=trusted&access_token=secret',
        'es',
      ),
    ).toBe('/es/portal?ref=trusted');
    expect(sanitizeLocaleSwitchDestination('/en/portal', 'es')).toBe('/es');
  });
});

describe('explicit locale preference contract', () => {
  it('updates the cookie without inventing an anonymous profile write', () => {
    expect(getExplicitLocalePersistencePlan(false)).toEqual({
      cookie: true,
      profile: false,
      profileFailureBlocksNavigation: false,
    });
  });

  it('defers an authenticated profile write without blocking navigation', () => {
    expect(getExplicitLocalePersistencePlan(true)).toEqual({
      cookie: true,
      profile: true,
      profileFailureBlocksNavigation: false,
    });
  });

  it('warns before leaving marked unsaved state', () => {
    const confirmDiscard = vi.fn(() => false);
    expect(canContinueLocaleSwitch(true, confirmDiscard)).toBe(false);
    expect(confirmDiscard).toHaveBeenCalledOnce();
  });

  it('does not prompt when no unsaved state is marked', () => {
    const confirmDiscard = vi.fn(() => false);
    expect(canContinueLocaleSwitch(false, confirmDiscard)).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});
