import type { Locale } from '@/modules/localization/locales';
import type { PublicServicesV1 } from '@/modules/content/domain/public-services';
import type {
  PublicContactSettingsV1,
  PublicHomepageContentV1,
} from '@/modules/settings/domain/public-settings';

import { getPublicSiteCopy } from '../copy';
import { ContactActions } from './contact-actions';

type HomepageProps = Readonly<{
  contact: PublicContactSettingsV1;
  content: PublicHomepageContentV1;
  locale: Locale;
  services: PublicServicesV1;
}>;

export function Homepage({
  contact,
  content,
  locale,
  services,
}: HomepageProps) {
  const copy = getPublicSiteCopy(locale);
  const serviceItems = services.items.length
    ? services.items.map((service) => ({
        key: service.key,
        requiresReview: false,
        summary: service.summary,
        title: service.title,
      }))
    : copy.fallbackServices;
  const processSteps = content.processSteps?.length
    ? content.processSteps
    : copy.process.steps;

  return (
    <article className="homepage">
      <section aria-labelledby="hero-heading" className="hero-section">
        <div className="shell-container hero-grid">
          <div className="hero-copy">
            <p className="section-eyebrow">
              {content.hero?.eyebrow ?? copy.hero.eyebrow}
            </p>
            <h1 id="hero-heading">
              {content.hero?.heading ?? copy.hero.heading}
            </h1>
            <p>{content.hero?.body ?? copy.hero.body}</p>
            <ContactActions
              contact={contact}
              labels={{
                primary: content.callToAction?.primaryLabel,
                secondary: content.callToAction?.secondaryLabel,
              }}
              locale={locale}
            />
          </div>
          <aside aria-label={copy.trust.heading} className="hero-assurance">
            <span aria-hidden="true" className="assurance-mark">
              ✓
            </span>
            <p>{copy.trust.points[0]}</p>
            <p>{copy.trust.points[2]}</p>
          </aside>
        </div>
      </section>

      <section
        aria-labelledby="services-heading"
        className="homepage-section"
        id="services"
      >
        <div className="shell-container">
          <div className="section-introduction">
            <p className="section-kicker">01</p>
            <h2 id="services-heading">
              {content.servicesIntroduction?.heading ?? copy.services.heading}
            </h2>
            <p>{content.servicesIntroduction?.body ?? copy.services.body}</p>
          </div>
          <ul className="service-grid">
            {serviceItems.map((service) => (
              <li className="service-card" key={service.key}>
                <h3>{service.title}</h3>
                <p>{service.summary}</p>
                {service.requiresReview ? (
                  <span className="review-badge">{copy.reviewRequired}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="process-heading"
        className="homepage-section process-section"
      >
        <div className="shell-container process-layout">
          <div className="section-introduction">
            <p className="section-kicker">02</p>
            <h2 id="process-heading">{copy.process.heading}</h2>
            <p>{copy.process.body}</p>
          </div>
          <ol className="process-list">
            {processSteps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="portal-heading"
        className="homepage-section portal-section"
      >
        <div className="shell-container portal-card">
          <div>
            <p className="section-eyebrow">{copy.portal.eyebrow}</p>
            <h2 id="portal-heading">
              {content.portalIntroduction?.heading ?? copy.portal.heading}
            </h2>
            <p>{content.portalIntroduction?.body ?? copy.portal.body}</p>
          </div>
          <div className="portal-status">
            <strong>{copy.portal.status}</strong>
            <a href={`/${locale}/portal`}>{copy.portal.linkLabel}</a>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="trust-heading"
        className="homepage-section trust-section"
      >
        <div className="shell-container trust-layout">
          <div className="section-introduction">
            <p className="section-kicker">03</p>
            <h2 id="trust-heading">
              {content.trustSection?.heading ?? copy.trust.heading}
            </h2>
            <p>{content.trustSection?.body ?? copy.trust.body}</p>
          </div>
          <ul className="trust-list">
            {copy.trust.points.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="cta-heading" className="contact-section">
        <div className="shell-container contact-card">
          <div>
            <p className="section-eyebrow">{copy.cta.heading}</p>
            <h2 id="cta-heading">
              {content.callToAction?.heading ?? copy.cta.heading}
            </h2>
            <p>{content.callToAction?.body ?? copy.cta.body}</p>
          </div>
          <ContactActions
            contact={contact}
            labels={{
              primary: content.callToAction?.primaryLabel,
              secondary: content.callToAction?.secondaryLabel,
            }}
            locale={locale}
          />
        </div>
      </section>
    </article>
  );
}
