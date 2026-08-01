import type { Locale } from './locales';

export type AppMessages = typeof import('./messages/en.json');

const messageLoaders = {
  en: () => import('./messages/en.json'),
  es: () => import('./messages/es.json'),
} satisfies Record<Locale, () => Promise<{ default: AppMessages }>>;

export async function loadMessages(locale: Locale): Promise<AppMessages> {
  return (await messageLoaders[locale]()).default;
}
