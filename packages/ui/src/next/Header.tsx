'use client'

import * as React from 'react'
import Link from 'next/link'
import { useCurrentLocale } from './useCurrentLocale'
import { Button } from '../components/ui/button'

export interface HeaderProps {
  userButton?: React.ReactNode
  signInButton?: React.ReactNode
  dashboardCta?: React.ReactNode
  navigation?: Array<{
    name: string
    href: string
  }>
  title?: string
  subtitle?: string
  logo?: React.ReactNode
  languageSwitcher?: React.ReactNode
  pathname?: string
}

export function Header({
  userButton,
  signInButton,
  dashboardCta,
  navigation,
  title = 'MS Elevate',
  subtitle = 'LEAPS Tracker',
  logo,
  languageSwitcher,
  pathname: providedPathname,
}: HeaderProps) {
  const { locale, pathname: runtimePathname, withLocale } = useCurrentLocale()
  const pathname = providedPathname ?? runtimePathname ?? '/'

  const defaultNavigation = [
    { name: 'Home', href: '/' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Learn', href: '/metrics/learn' },
    { name: 'Explore', href: '/metrics/explore' },
    { name: 'Amplify', href: '/metrics/amplify' },
    { name: 'Present', href: '/metrics/present' },
    { name: 'Shine', href: '/metrics/shine' },
  ]

  const navItems = navigation || defaultNavigation

  // Prefer supplied pathname but keep withLocale from hook

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link href={withLocale('/')} className="flex items-center">
              {logo || (
                <>
                  <div className="text-2xl font-bold text-blue-600">
                    {title}
                  </div>
                  <div className="ml-2 text-sm text-gray-600">{subtitle}</div>
                </>
              )}
            </Link>

            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={withLocale(item.href)}
                  className={`text-sm font-medium transition-colors ${
                    pathname === withLocale(item.href)
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {languageSwitcher}
            {signInButton}
            {dashboardCta || (
              <Link href={withLocale('/dashboard')}>
                <Button variant="default">Dashboard</Button>
              </Link>
            )}
            {userButton}
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden border-t bg-gray-50">
        <nav className="flex overflow-x-auto py-2 px-4 space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={withLocale(item.href)}
              className={`whitespace-nowrap text-sm font-medium transition-colors ${
                pathname === withLocale(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
