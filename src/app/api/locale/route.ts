import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  getLocaleCookieOptions,
  LOCALE_COOKIE_NAME,
} from '@/modules/localization/locale-cookie';
import { sanitizeLocaleSwitchDestination } from '@/modules/localization/locale-switch';
import { isSupportedLocale } from '@/modules/localization/locales';

export function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale');

  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ status: 'invalid-locale' }, { status: 400 });
  }

  const destination = sanitizeLocaleSwitchDestination(
    request.nextUrl.searchParams.get('path'),
    locale,
  );
  const response = NextResponse.redirect(
    new URL(destination, request.url),
    303,
  );

  response.cookies.set(LOCALE_COOKIE_NAME, locale, getLocaleCookieOptions());
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
