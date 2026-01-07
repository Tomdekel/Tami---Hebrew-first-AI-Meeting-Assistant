export const locales = ['en', 'he'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'he';

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
