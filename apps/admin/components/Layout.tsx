'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser, SignOutButton } from '@clerk/nextjs'
import { Button } from '@elevate/ui'

interface NavItem {
  href: string
  label: string
  icon: string
  roles: string[]
}

const navItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: '📊',
    roles: ['reviewer', 'admin', 'superadmin']
  },
  {
    href: '/admin/submissions',
    label: 'Review Queue',
    icon: '📝',
    roles: ['reviewer', 'admin', 'superadmin']
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: '👥',
    roles: ['admin', 'superadmin']
  },
  {
    href: '/admin/badges',
    label: 'Badges',
    icon: '🏆',
    roles: ['admin', 'superadmin']
  },
  {
    href: '/admin/exports',
    label: 'Exports',
    icon: '📁',
    roles: ['admin', 'superadmin']
  }
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, isLoaded } = useUser()
  
  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const userRole = ((user?.publicMetadata as any)?.role || 'participant').toLowerCase()
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:inset-0
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              MS
            </div>
            <span className="font-semibold text-gray-900">Elevate Admin</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <nav className="mt-8">
          <div className="px-4 space-y-2">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User info at bottom */}
        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {userRole}
              </p>
            </div>
          </div>
          <SignOutButton>
            <Button 
              variant="ghost" 
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                fontSize: '14px'
              }}
            >
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>

      {/* Main content */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {getPageTitle(pathname)}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-sm text-gray-600">
              {user?.emailAddresses[0]?.emailAddress}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/submissions': 'Review Queue',
    '/admin/users': 'User Management',
    '/admin/badges': 'Badge Management',
    '/admin/exports': 'Data Exports'
  }
  
  // Handle dynamic routes
  if (pathname.startsWith('/admin/review/')) {
    return 'Review Submission'
  }
  
  return titles[pathname] || 'Admin Console'
}