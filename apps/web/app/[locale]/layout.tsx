import { headers } from 'next/headers'
import Link from 'next/link'

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'

import { Button } from '@elevate/ui'
import { ClientHeader, Footer } from '@elevate/ui/next'

import { locales } from '../../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

import type { Metadata } from 'next'

type Props = {
  children: React.ReactNode
  params: Promise<{
    locale: string
  }>
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const _t = await getTranslations({ locale, namespace: 'homepage' })
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const baseUrl = `${proto}://${host}`

  return {
    metadataBase: new URL(baseUrl),
    title: 'Microsoft Elevate Indonesia — AI for Educators',
    description:
      'Join the LEAPS journey to learn, apply, amplify, present, and shine. Earn points, unlock badges, and compete for national recognition in Jakarta.',
    keywords: [
      'AI for Educators Indonesia',
      'pelatihan guru AI',
      '21st Century Learning',
      'Microsoft Certified Educator',
      'LEAPS framework',
      'Indonesian educators',
      'teacher training',
      'educational technology',
      'classroom AI',
      'professional development',
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
      url:
        locale === 'en'
          ? 'https://leaps.mereka.org'
          : `https://leaps.mereka.org/${locale}`,
      title: 'Unlock AI. Transform Classrooms. Rise Together.',
      description:
        'Join the LEAPS journey to learn, apply, amplify, present, and shine. Earn points, unlock badges, and compete for national recognition in Jakarta.',
      siteName: 'MS Elevate LEAPS Tracker',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Educator leading AI-assisted lesson in Indonesia',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Unlock AI. Transform Classrooms. Rise Together.',
      description:
        'Join the LEAPS journey to learn, apply, amplify, present, and shine. Earn points, unlock badges, and compete for national recognition in Jakarta.',
      images: ['/og-image.jpg'],
      creator: '@MicrosoftEDU',
    },
    verification: {
      google: 'your-google-verification-code',
      yandex: 'your-yandex-verification-code',
    },
    alternates: {
      canonical:
        locale === 'en'
          ? 'https://leaps.mereka.org'
          : `https://leaps.mereka.org/${locale}`,
      languages: {
        en: 'https://leaps.mereka.org',
        id: 'https://leaps.mereka.org/id',
      },
    },
    category: 'education',
    classification: 'Educational Technology Platform',
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      <ClientHeader
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
        dashboardCta={
          <SignedIn>
            <Link href={`/${locale}/dashboard`}>
              <Button variant="default">Dashboard</Button>
            </Link>
          </SignedIn>
        }
        languageSwitcher={<LanguageSwitcher />}
      />
      <main className="flex-1">{children}</main>
      <Footer />

      {/* JSON-LD structured data (use @graph to avoid client parsing issues) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'EducationalOrganization',
                name: 'MS Elevate LEAPS Tracker',
                description:
                  'Transform your teaching with AI through the LEAPS framework',
                url: 'https://leaps.mereka.org',
                logo: 'https://leaps.mereka.org/logo.png',
                sameAs: [
                  'https://twitter.com/MicrosoftEDU',
                  'https://linkedin.com/company/microsoft',
                ],
                address: {
                  '@type': 'PostalAddress',
                  addressCountry: 'ID',
                  addressRegion: 'Jakarta',
                },
                offers: {
                  '@type': 'Offer',
                  category: 'Educational Program',
                  name: 'LEAPS Framework Training',
                  description:
                    'Professional development program for educators to integrate AI in classrooms',
                },
              },
              {
                '@type': 'Event',
                name: 'Educators Convening Jakarta',
                description:
                  'National recognition event for top 10-15 educators based on LEAPS points and policy ideas',
                location: {
                  '@type': 'Place',
                  name: 'Jakarta',
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Jakarta',
                    addressCountry: 'ID',
                  },
                },
                organizer: {
                  '@type': 'Organization',
                  name: 'Microsoft Indonesia',
                },
                eventAttendanceMode:
                  'https://schema.org/OfflineEventAttendanceMode',
                eventStatus: 'https://schema.org/EventScheduled',
              },
              {
                '@type': 'HowTo',
                name: 'LEAPS Framework for AI Education',
                description:
                  '5-stage journey for educators to integrate AI tools in classrooms',
                step: [
                  {
                    '@type': 'HowToStep',
                    name: 'Learn',
                    text: 'Complete AI for Educators course (Kajabi completion tags award points automatically)',
                    url: 'https://leaps.mereka.org/metrics/learn',
                  },
                  {
                    '@type': 'HowToStep',
                    name: 'Explore',
                    text: 'Implement AI tools in classroom and document experience',
                    url: 'https://leaps.mereka.org/dashboard/explore',
                  },
                  {
                    '@type': 'HowToStep',
                    name: 'Amplify',
                    text: 'Train peers and students on AI education',
                    url: 'https://leaps.mereka.org/dashboard/amplify',
                  },
                  {
                    '@type': 'HowToStep',
                    name: 'Present',
                    text: 'Share your AI education story on LinkedIn',
                    url: 'https://leaps.mereka.org/dashboard/present',
                  },
                  {
                    '@type': 'HowToStep',
                    name: 'Shine',
                    text: 'Submit policy ideas for national recognition',
                    url: 'https://leaps.mereka.org/dashboard/shine',
                  },
                ],
              },
            ],
          }),
        }}
      />
    </NextIntlClientProvider>
  )
}
