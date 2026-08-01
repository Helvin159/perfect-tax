# Locale-switch query allowlist

Language changes rebuild the destination from the current locale-prefixed path.
They never forward arbitrary query parameters.

The following non-personal marketing-attribution parameters are allowed:

| Parameter      | Maximum length | Why it is safe to preserve              |
| -------------- | -------------: | --------------------------------------- |
| `ref`          |             64 | A constrained campaign or partner code. |
| `utm_source`   |             40 | A constrained marketing-source label.   |
| `utm_medium`   |             40 | A constrained marketing-channel label.  |
| `utm_campaign` |             80 | A constrained marketing-campaign label. |

Every value must start with an ASCII letter or number and contain only ASCII
letters, numbers, periods, underscores, or hyphens. Only the first value is
preserved. Empty, invalid, or oversized values are dropped.

All other parameters are dropped, including tokens, codes, callbacks, return
URLs, email addresses, search text, authentication state, and user-entered
values. The cookie-writing route validates the destination and allowlist again;
it never accepts an external redirect.
