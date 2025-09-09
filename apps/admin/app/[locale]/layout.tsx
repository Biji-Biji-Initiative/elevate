import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'


import type { Metadata } from 'next'

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic'

type Props = {
  children: React.ReactNode;
  params: {
    locale: string;
  };
};

// Remove generateStaticParams to prevent static generation
// export async function generateStaticParams() {
//   return locales.map((locale) => ({ locale }));
// }

export async function generateMetadata({ 
  params 
}: { 
  params: { locale: string } 
}): Promise<Metadata> {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: 'dashboard' })
  
  return {
    title: {
      template: '%s - MS Elevate LEAPS Admin',
      default: t('title')
    },
    description: 'Admin console for MS Elevate LEAPS Tracker',
    robots: {
      index: false, // Admin pages should not be indexed
      follow: false,
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = params
  const messages = await getMessages({ locale })
  
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
