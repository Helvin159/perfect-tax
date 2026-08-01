import type { Locale } from '@/modules/localization/locales';

import { getPublicSiteCopy, type PublicSiteDocument } from '../copy';

type LegalPlaceholderProps = Readonly<{
  document: PublicSiteDocument;
  locale: Locale;
}>;

export function LegalPlaceholder({ document, locale }: LegalPlaceholderProps) {
  const copy = getPublicSiteCopy(locale).legal;

  return (
    <section className="shell-placeholder legal-placeholder">
      <p className="shell-eyebrow">{copy.eyebrow}</p>
      <h1>{copy.titles[document]}</h1>
      <p className="placeholder-status" role="status">
        {copy.status}
      </p>
      <p>{copy.body}</p>
    </section>
  );
}
