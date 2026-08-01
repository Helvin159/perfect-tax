import type { PublicContentLocale } from '../workflow/types';
import {
  CmsUnavailableError,
  InvalidPublicContentError,
} from '../domain/publication';
import type { PublicResourceType } from '../domain/public-resource';

export type SafeCmsDiagnostic = Readonly<{
  code:
    | 'cms-unavailable'
    | 'invalid-public-content'
    | 'unexpected-public-content-failure';
  locale: PublicContentLocale;
  resource: PublicResourceType;
}>;

export type SafeCmsLogger = (diagnostic: SafeCmsDiagnostic) => void;

export const logSafeCmsDiagnostic: SafeCmsLogger = (diagnostic) => {
  console.error('[public-cms]', diagnostic);
};

export async function safePublicLoad<T>(
  args: Readonly<{
    fallback: () => T;
    load: () => Promise<T>;
    locale: PublicContentLocale;
    logger?: SafeCmsLogger;
    resource: PublicResourceType;
  }>,
): Promise<T> {
  try {
    return await args.load();
  } catch (error) {
    const code =
      error instanceof InvalidPublicContentError
        ? 'invalid-public-content'
        : error instanceof CmsUnavailableError
          ? 'cms-unavailable'
          : 'unexpected-public-content-failure';
    (args.logger ?? logSafeCmsDiagnostic)({
      code,
      locale: args.locale,
      resource: args.resource,
    });
    return args.fallback();
  }
}
