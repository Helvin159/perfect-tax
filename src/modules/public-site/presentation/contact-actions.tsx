import type { Locale } from '@/modules/localization/locales';
import type { PublicContactSettingsV1 } from '@/modules/settings/domain/public-settings';

import { getPublicContactActions } from '../contact-actions';
import { getPublicSiteCopy } from '../copy';

type ContactActionsProps = Readonly<{
  contact: PublicContactSettingsV1;
  labels?: Readonly<{ primary?: string; secondary?: string }>;
  locale: Locale;
  showHeading?: boolean;
}>;

export function ContactActions({
  contact,
  labels,
  locale,
  showHeading = false,
}: ContactActionsProps) {
  const copy = getPublicSiteCopy(locale);
  const actions = getPublicContactActions(contact, locale, labels);
  const includesWrittenChannel = actions.some(
    ({ channel }) => channel === 'email' || channel === 'whatsapp',
  );

  return (
    <div className="contact-actions">
      {showHeading ? <h2>{copy.placeholders.contactHeading}</h2> : null}
      {actions.length ? (
        <ul aria-label={copy.placeholders.contactHeading}>
          {actions.map((action) => (
            <li key={action.channel}>
              <a
                className={
                  action.emphasis === 'primary'
                    ? 'button button-primary'
                    : action.emphasis === 'secondary'
                      ? 'button button-secondary'
                      : 'contact-text-link'
                }
                href={action.href}
                rel={action.channel === 'whatsapp' ? 'noreferrer' : undefined}
              >
                {action.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="contact-unavailable" role="status">
          {copy.cta.noChannels}
        </p>
      )}
      {includesWrittenChannel ? (
        <p className="channel-warning">{copy.cta.safety}</p>
      ) : null}
    </div>
  );
}
