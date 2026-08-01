# Public CMS caching and invalidation

Only `src/modules/settings/public.ts` and `src/modules/content/public.ts` compose
the public Payload repositories. Route and server components consume those
typed functions and never receive generated Payload document types.

## Cache layers

- Request-cached: all five public retrieval functions use React `cache` to
  deduplicate repeated reads during one server render.
- Persistently server-cached: valid or deterministically missing published
  business identity, contact settings, portal settings, homepage content, and
  service projections use Next.js `unstable_cache` for five minutes. Each key
  and tag contains cache schema version, resource, locale, and `published`
  eligibility.
- Not cached: Payload exceptions, invalid published records, safe diagnostics,
  raw Payload documents, draft/version reads, workflow metadata, CMS user
  references, and private content. Failure fallbacks are returned outside the
  persistent cache and are only request-deduplicated.

Repositories always set `draft: false` and `fallbackLocale: false`. Projectors
then independently require `_status: published`, a current per-locale
`translationWorkflow` publication, and the applicable bilingual or urgent
publication policy.

## Invalidation

Each global and the services collection has an `afterChange` hook. A hook
invalidates only its eligible locale tags when the resulting document is a
publication-eligible published revision. Draft saves do nothing, leaving the
last published projection available. Publishing an inactive service still
invalidates the services tags so the former public service can disappear.

Publishing public media invalidates only the business-identity tags because
that is the only current public projection that embeds media. No global
clear-all tag or external cache provider is used. Deleting an already-public
service or public-media record invalidates both locale tags for its affected
projection.
