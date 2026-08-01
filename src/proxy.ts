import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  LOCALE_COOKIE_NAME,
  readLocaleCookie,
} from './modules/localization/locale-cookie';
import { extractRouteLocale } from './modules/localization/locales';
import { selectRootRedirectLocale } from './modules/localization/negotiation';
import { routing } from './modules/localization/routing';

const handleLocaleRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (extractRouteLocale(pathname)) {
    return handleLocaleRouting(request);
  }

  if (pathname !== '/') {
    return NextResponse.next();
  }

  // Authentication is intentionally absent in Phase 1. A future adapter can
  // supply this value through AuthenticatedLocalePreferenceReader.
  const profileLocale = undefined;
  const selection = selectRootRedirectLocale({
    acceptLanguage: request.headers.get('accept-language'),
    cookieLocale: readLocaleCookie(
      request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    ),
    profileLocale,
  });
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${selection.locale}`;

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/', '/en/:path*', '/es/:path*'],
};
