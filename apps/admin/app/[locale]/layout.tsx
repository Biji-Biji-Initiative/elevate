import { getTranslations } from 'next-intl/server'

import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type LayoutProps = {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dashboard' })

  return {
    title: {
      template: '%s - MS Elevate LEAPS Admin',
      default: t('title'),
    },
    description: 'Admin console for MS Elevate LEAPS Tracker',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function LocaleLayout({ children }: LayoutProps) {
  // The root layout provides NextIntlClientProvider; just render children here
  return children as React.ReactNode
}
