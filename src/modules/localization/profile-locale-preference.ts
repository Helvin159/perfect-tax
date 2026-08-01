import type { Locale } from './locales';

/**
 * Phase 2 authentication can implement this boundary without coupling locale
 * negotiation to a specific session or profile library.
 */
export interface AuthenticatedLocalePreferenceReader<RequestContext> {
  readPreferredLocale(
    context: RequestContext,
  ): Locale | undefined | Promise<Locale | undefined>;
}

/**
 * Phase 2 can implement this after authentication exists. It must be invoked
 * only for an explicit language switch, never for a bookmark, login, or direct
 * locale-prefixed navigation.
 */
export interface AuthenticatedLocalePreferenceWriter<RequestContext> {
  persistExplicitLocalePreference(
    locale: Locale,
    context: RequestContext,
  ): Promise<void>;
}

export type ExplicitLocalePersistencePlan = Readonly<{
  cookie: true;
  profile: boolean;
  profileFailureBlocksNavigation: false;
}>;

export function getExplicitLocalePersistencePlan(
  hasAuthenticatedProfile: boolean,
): ExplicitLocalePersistencePlan {
  return Object.freeze({
    cookie: true,
    profile: hasAuthenticatedProfile,
    profileFailureBlocksNavigation: false,
  });
}
