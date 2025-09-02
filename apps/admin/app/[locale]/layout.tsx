import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminLayout } from '@elevate/ui'
import { AuthProvider } from '@elevate/auth/context'
import { Metadata } from 'next'
import { locales } from '../../i18n'

type Props = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  
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
  const { locale } = await params;
  const messages = await getMessages();
  
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <AdminLayout>{children}</AdminLayout>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}