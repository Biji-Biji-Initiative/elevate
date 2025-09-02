import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import { Metadata } from 'next'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    template: '%s - MS Elevate LEAPS Tracker',
    default: 'MS Elevate LEAPS Tracker - Unlock AI in Education'
  },
  description: 'Transform your teaching with AI through the LEAPS framework. Learn, Explore, Amplify, Present, and Shine alongside Indonesia\'s most innovative educators in the Microsoft Elevate program.',
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
    locale: 'en_US',
    url: 'https://leaps.mereka.org',
    title: 'MS Elevate LEAPS Tracker - Unlock AI in Education',
    description: 'Transform your teaching with AI through the LEAPS framework. Join thousands of Indonesian educators in the Microsoft Elevate program.',
    siteName: 'MS Elevate LEAPS Tracker',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MS Elevate LEAPS Tracker - AI in Education',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MS Elevate LEAPS Tracker - Unlock AI in Education',
    description: 'Transform your teaching with AI through the LEAPS framework. Join thousands of Indonesian educators.',
    images: ['/og-image.jpg'],
    creator: '@MicrosoftEDU',
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
  },
  alternates: {
    canonical: 'https://leaps.mereka.org',
    languages: {
      'en-US': 'https://leaps.mereka.org',
      'id-ID': 'https://leaps.mereka.org/id',
    },
  },
  category: 'education',
  classification: 'Educational Technology Platform',
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="scroll-smooth">
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" href="/icon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.json" />
          
          {/* Preconnect to external domains */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          
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
        </head>
        <body className={`${inter.className} min-h-screen flex flex-col`}>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          
          {/* Analytics and performance monitoring would go here */}
          {process.env.NODE_ENV === 'production' && (
            <>
              {/* Google Analytics */}
              <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID" />
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'GA_MEASUREMENT_ID');
                  `,
                }}
              />
            </>
          )}
        </body>
      </html>
    </ClerkProvider>
  )
}
