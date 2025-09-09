'use client'

import { usePathname } from 'next/navigation'

export function useCurrentLocale() {
  const pathname = usePathname() ?? '/'
  const match = pathname.match(/^\/(en|id)(\/|$)/)
  const locale = match?.[1]
  const withLocale = (href: string) => (locale ? `/${locale}${href}` : href)
  return { locale, pathname, withLocale }
}

