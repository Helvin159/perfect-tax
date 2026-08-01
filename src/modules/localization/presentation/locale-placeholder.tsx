import { getTranslations } from 'next-intl/server';

import type { Locale } from '../locales';

type LocalePlaceholderProps = Readonly<{
  locale: Locale;
}>;

export async function LocalePlaceholder({ locale }: LocalePlaceholderProps) {
  const translations = await getTranslations({
    locale,
    namespace: 'LocalePlaceholder',
  });

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="w-full max-w-xl rounded-xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          {translations('eyebrow')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {translations('title')}
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          {translations('description')}
        </p>
      </section>
    </main>
  );
}
