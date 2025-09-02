'use client'

import { Header } from './Header'

interface ClientHeaderProps {
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
  return <Header {...props} />
}