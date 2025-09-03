import { getRequestConfig } from 'next-intl/server';

// Supported locales - can be imported from a shared config
export const locales = ['en', 'id'] as const;
export type Locale = typeof locales[number];

// Default locale
export const defaultLocale: Locale = 'en';

// Dynamic imports for better code splitting
const loadMessages = async (locale: string) => {
  switch (locale) {
    case 'en':
      return (await import('./messages/en.json')).default;
    case 'id':
      return (await import('./messages/id.json')).default;
    default:
      throw new Error(`Unsupported locale: ${locale}`);
  }
};

export default getRequestConfig(async ({ requestLocale }) => {
  // Await the locale parameter since it's a Promise
  let locale = await requestLocale;
  
  // Ensure locale is a string and validate
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: locale === 'id' ? 'Asia/Jakarta' : 'UTC', // Default timezone for Indonesian users
    now: new Date(),
  };
});
