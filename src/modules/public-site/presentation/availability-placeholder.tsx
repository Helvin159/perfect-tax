import type { Locale } from '@/modules/localization/locales';
import type {
  PublicContactSettingsV1,
  PublicPortalSettingsV1,
} from '@/modules/settings/domain/public-settings';

import { getPublicSiteCopy } from '../copy';
import { ContactActions } from './contact-actions';

type AvailabilityPlaceholderProps = Readonly<{
  contact: PublicContactSettingsV1;
  locale: Locale;
  portal: PublicPortalSettingsV1;
  surface: 'portal' | 'sign-in';
}>;

export function AvailabilityPlaceholder({
  contact,
  locale,
  portal,
  surface,
}: AvailabilityPlaceholderProps) {
  const copy = getPublicSiteCopy(locale);
  const pageCopy =
    copy.placeholders[surface === 'sign-in' ? 'signIn' : 'portal'];
  const approvedNotice =
    surface === 'sign-in' ? portal.signInMessage : portal.transitionNotice;

  return (
    <section className="shell-placeholder availability-placeholder">
      <p className="shell-eyebrow">{pageCopy.eyebrow}</p>
      <h1>{pageCopy.heading}</h1>
      <p>{pageCopy.body}</p>
      {approvedNotice ? (
        <aside className="approved-notice">
          <h2>{copy.placeholders.approvedNotice}</h2>
          <p>{approvedNotice}</p>
        </aside>
      ) : null}
      <ContactActions contact={contact} locale={locale} showHeading />
    </section>
  );
}
