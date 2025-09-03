import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { ClientHeader, Footer, Button } from '@elevate/ui'


import { locales } from '../../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

import type { Metadata } from 'next'

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
  const t = await getTranslations({ locale, namespace: 'homepage' });
  
  return {
    title: {
      template: '%s - MS Elevate LEAPS Tracker',
      default: t('title')
    },
    description: t('subtitle'),
    keywords: [
      'AI in education',
      'Microsoft Elevate', 
      'LEAPS framework',
      'Indonesian educators',
      'teacher training',
      'educational technology',
      'classroom AI',
      'professional development'
    ],
    authors: [{ name: 'Microsoft Indonesia' }],
    creator: 'Microsoft Indonesia',
    publisher: 'Microsoft Corporation',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
      url: locale === 'en' ? 'https://leaps.mereka.org' : `https://leaps.mereka.org/${locale}`,
      title: t('hero_title'),
      description: t('hero_subtitle'),
      siteName: 'MS Elevate LEAPS Tracker',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: t('hero_title'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('hero_title'),
      description: t('hero_subtitle'),
      images: ['/og-image.jpg'],
      creator: '@MicrosoftEDU',
    },
    verification: {
      google: 'your-google-verification-code',
      yandex: 'your-yandex-verification-code',
    },
    alternates: {
      canonical: locale === 'en' ? 'https://leaps.mereka.org' : `https://leaps.mereka.org/${locale}`,
      languages: {
        'en': 'https://leaps.mereka.org',
        'id': 'https://leaps.mereka.org/id',
      },
    },
    category: 'education',
    classification: 'Educational Technology Platform',
  };
}

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = await params;
  const messages = await getMessages();
  
  return (
    <NextIntlClientProvider messages={messages}>
      <ClientHeader 
        isSignedIn={false}
        signInButton={
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost">Sign In</Button>
            </SignInButton>
          </SignedOut>
        }
        userButton={
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        }
        languageSwitcher={<LanguageSwitcher />}
      />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": "MS Elevate LEAPS Tracker",
            "description": "Transform your teaching with AI through the LEAPS framework",
            "url": "https://leaps.mereka.org",
            "logo": "https://leaps.mereka.org/logo.png",
            "sameAs": [
              "https://twitter.com/MicrosoftEDU",
              "https://linkedin.com/company/microsoft"
            ],
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "ID",
              "addressRegion": "Jakarta"
            },
            "offers": {
              "@type": "Offer",
              "category": "Educational Program",
              "name": "LEAPS Framework Training",
              "description": "Professional development program for educators to integrate AI in classrooms"
            }
          })
        }}
      />
    </NextIntlClientProvider>
  );
}