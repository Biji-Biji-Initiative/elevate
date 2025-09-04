'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from './Header'

export interface ClientHeaderProps {
  isSignedIn?: boolean
  userButton?: React.ReactNode
  signInButton?: React.ReactNode
  navigation?: Array<{
    name: string
    href: string
  }>
  title?: string
  subtitle?: string
  logo?: React.ReactNode
  languageSwitcher?: React.ReactNode
}

export function ClientHeader(props: ClientHeaderProps) {
  const pathname = usePathname()
  return <Header {...props} pathname={pathname} />
}