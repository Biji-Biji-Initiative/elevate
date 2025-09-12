import * as React from 'react'

// Local font loader with offline fallback
import { getRootFontClass } from './lib/local-fonts'
import { headers } from 'next/headers'
import Script from 'next/script'


import type { Metadata } from 'next'
import '@elevate/ui/styles/globals.css'


// Root layout - minimal metadata, detailed metadata moved to locale layout

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const baseUrl = `${proto}://${host}`
  return {
    metadataBase: new URL(baseUrl),
  }
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const rootFontClass = await getRootFontClass()
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* No external font preconnects in offline-friendly build */}
      </head>
      <body className={`${rootFontClass} min-h-screen flex flex-col font-sans`}>
        {children}
        
        {/* Analytics and performance monitoring would go here */}
        {process.env.NODE_ENV === 'production' && (
          <>
            {/* Google Analytics */}
            <Script src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID" strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);} 
                gtag('js', new Date());
                gtag('config', 'GA_MEASUREMENT_ID');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
