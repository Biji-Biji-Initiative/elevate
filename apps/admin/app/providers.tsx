'use client'

import type { ReactNode } from 'react'

import { usePathname } from 'next/navigation'

import { useUser, SignOutButton, ClerkProvider } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'

import { AuthProvider } from '@elevate/auth/context'
import { AdminLayout } from '@elevate/ui/next'

interface ProvidersProps {
  children: ReactNode
}

function AdminLayoutWrapper({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const tnav = useTranslations('navigation')
  
  // Derive user role from Clerk public metadata if available
  const userRole = (user?.publicMetadata as { role?: string } | undefined)?.role || 'participant'

  const navItems: Array<{ href: string; label: string; icon: string; roles: string[] }> = [
    { href: '/admin', label: tnav('dashboard'), icon: '📊', roles: ['reviewer', 'admin', 'superadmin'] },
    { href: '/admin/submissions', label: tnav('submissions'), icon: '📝', roles: ['reviewer', 'admin', 'superadmin'] },
    { href: '/admin/users', label: tnav('users'), icon: '👥', roles: ['admin', 'superadmin'] },
    { href: '/admin/badges', label: tnav('badges'), icon: '🏆', roles: ['admin', 'superadmin'] },
    { href: '/admin/exports', label: tnav('exports'), icon: '📁', roles: ['admin', 'superadmin'] },
    { href: '/admin/kajabi', label: tnav('kajabi'), icon: '🔗', roles: ['admin', 'superadmin'] },
    { href: '/admin/referrals', label: tnav('referrals'), icon: '🔁', roles: ['admin', 'superadmin'] },
    { href: '/admin/storage', label: tnav('storage'), icon: '🗄️', roles: ['admin', 'superadmin'] },
    { href: '/admin/ops', label: tnav('ops'), icon: '🛠️', roles: ['admin', 'superadmin'] },
  ] as const

  const adminLayoutProps = {
    isLoaded,
    signOutButton: <SignOutButton />,
    children,
    pathname, // Pass pathname to AdminLayout
    userRole,
    navItems,
    ...(user && {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddresses: user.emailAddresses?.map(ea => ({ emailAddress: ea.emailAddress })),
        publicMetadata: user.publicMetadata as Record<string, unknown>
      }
    })
  }
  
  return <AdminLayout {...adminLayoutProps} />
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider>
      <AuthProvider>
        <AdminLayoutWrapper>
          {children}
        </AdminLayoutWrapper>
      </AuthProvider>
    </ClerkProvider>
  )
}
