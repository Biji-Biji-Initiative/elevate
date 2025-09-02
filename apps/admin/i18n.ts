import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Supported locales - can be imported from a shared config
export const locales = ['en', 'id'] as const;
export type Locale = typeof locales[number];

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

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();

  return {
    messages: await loadMessages(locale),
    timeZone: 'Asia/Jakarta', // Default timezone for Indonesian users
    now: new Date(),
  };
});