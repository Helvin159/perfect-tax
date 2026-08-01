import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

import { isSupportedLocale } from './locales';
import { loadMessages } from './messages';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
