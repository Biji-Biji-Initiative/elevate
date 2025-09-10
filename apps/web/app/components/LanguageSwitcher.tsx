'use client'

import React from 'react'

import { usePathname, useRouter } from 'next/navigation'

import { LanguageSwitcher as BaseLanguageSwitcher } from '@elevate/ui/blocks'

import { locales, type Locale } from '../../i18n'

export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname() || '/'

  const segments = pathname.split('/')
  const isLocale = (x: string): x is Locale =>
    (locales as readonly string[]).includes(x)
  const seg1 = segments[1] as string | undefined
  const current: Locale = seg1 && isLocale(seg1) ? (seg1 as Locale) : locales[0]

  const onLanguageChange = (next: string) => {
    if (!isLocale(next)) return
    const updated = [...segments]
    if (isLocale((updated[1] ?? '') as string)) {
      updated[1] = next as Locale
    } else {
      updated.splice(1, 0, next as Locale)
    }
    const nextPath = updated.join('/') || '/'
    router.push(nextPath)
  }

  return (
    <BaseLanguageSwitcher
      locale={current}
      onLanguageChange={onLanguageChange}
      variant="dropdown"
    />
  )
}
