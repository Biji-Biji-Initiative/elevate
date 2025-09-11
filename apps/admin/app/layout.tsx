import * as React from 'react'

// Use system fonts to avoid network fetch during offline builds
import { headers } from 'next/headers'

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

import '@elevate/ui/styles/globals.css'
import './globals.css'

import { Providers } from './providers'

import type { Metadata } from 'next'


// Force dynamic rendering for the entire admin app
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const messages = await getMessages()
  return (
    <html lang="en" className="scroll-smooth" data-scroll-behavior="smooth">
      <body className="font-sans">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return {
    metadataBase: new URL(`${proto}://${host}`),
  }
}
