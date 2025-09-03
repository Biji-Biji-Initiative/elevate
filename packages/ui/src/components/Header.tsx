'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from './ui/button.js'

interface HeaderProps {
  // User authentication state
  isSignedIn?: boolean
  userButton?: React.ReactNode
  signInButton?: React.ReactNode
  // Navigation
  navigation?: Array<{
    name: string
    href: string
  }>
  // Branding
  title?: string
  subtitle?: string
  logo?: React.ReactNode
  // Internationalization
  languageSwitcher?: React.ReactNode
  // Current path for navigation highlighting
  pathname?: string
}

export function Header({
  isSignedIn = false,
  userButton,
  signInButton,
  navigation,
  title = "MS Elevate",
  subtitle = "LEAPS Tracker",
  logo,
  languageSwitcher,
  pathname = '/' // Use provided pathname or default
}: HeaderProps) {
  
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

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              {logo || (
                <>
                  <div className="text-2xl font-bold text-blue-600">{title}</div>
                  <div className="ml-2 text-sm text-gray-600">{subtitle}</div>
                </>
              )}
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname === item.href
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
            {!isSignedIn && signInButton}
            {isSignedIn && (
              <>
                <Link href="/dashboard">
                  <Button variant="default">Dashboard</Button>
                </Link>
                {userButton}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t bg-gray-50">
        <nav className="flex overflow-x-auto py-2 px-4 space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`whitespace-nowrap text-sm font-medium transition-colors ${
                pathname === item.href
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