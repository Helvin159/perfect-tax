import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/locale/route';

describe('explicit locale cookie route', () => {
  it('sets the locale cookie only through an explicit switch request', () => {
    const request = new NextRequest(
      'https://example.test/api/locale?locale=es&path=%2Fes%2Fportal%3Fref%3Demail',
    );
    const response = GET(request);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://example.test/es/portal?ref=email',
    );
    expect(response.cookies.get('CLIENT_SERVICES_LOCALE')?.value).toBe('es');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not set a cookie for an invalid locale', async () => {
    const response = GET(
      new NextRequest('https://example.test/api/locale?locale=fr&path=%2Ffr'),
    );

    expect(response.status).toBe(400);
    expect(response.cookies.get('CLIENT_SERVICES_LOCALE')).toBeUndefined();
    await expect(response.json()).resolves.toEqual({
      status: 'invalid-locale',
    });
  });
});
