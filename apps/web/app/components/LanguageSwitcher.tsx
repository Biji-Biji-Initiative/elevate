'use client'

import React from 'react'

import { usePathname, useRouter } from 'next/navigation'

import { LanguageSwitcher as BaseLanguageSwitcher } from '@elevate/ui/blocks'

import { locales } from '../../i18n'

export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname() || '/'

  const segments = pathname.split('/')
  const current = locales.includes(segments[1]) ? segments[1] : locales[0]

  const onLanguageChange = (next: string) => {
    if (!locales.includes(next)) return
    const updated = [...segments]
    if (locales.includes(updated[1])) {
      updated[1] = next
    } else {
      updated.splice(1, 0, next)
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

