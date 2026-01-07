import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie or use default
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;

  let locale: Locale = defaultLocale;
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
