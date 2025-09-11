'use client'

import { usePathname } from 'next/navigation'

import { useUser, SignOutButton, ClerkProvider } from '@clerk/nextjs'
import { useTranslations, useLocale } from 'next-intl'

import { useAuth, AuthProvider } from '@elevate/auth/context'
import { AdminLayout } from '@elevate/ui/next'

interface ProvidersProps {
  children: React.ReactNode
}

function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const auth = useAuth()
  const pathname = usePathname()
  const tnav = useTranslations('navigation')
  const locale = useLocale()

  // Use normalized role from our AuthProvider to ensure dev overrides and
  // server/client consistency. This fixes UI gating/overlay issues when Clerk
  // metadata is out-of-sync.
  const userRole = auth.role

  const navItems: Array<{
    href: string
    label: string
    icon: string
    roles: string[]
  }> = [
    {
      href: `/${locale}`,
      label: tnav('dashboard'),
      icon: '📊',
      roles: ['reviewer', 'admin', 'superadmin'],
    },
    {
      href: `/${locale}/submissions`,
      label: tnav('submissions'),
      icon: '📝',
      roles: ['reviewer', 'admin', 'superadmin'],
    },
    {
      href: `/${locale}/users`,
      label: tnav('users'),
      icon: '👥',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/badges`,
      label: tnav('badges'),
      icon: '🏆',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/exports`,
      label: tnav('exports'),
      icon: '📁',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/kajabi`,
      label: tnav('kajabi'),
      icon: '🔗',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/referrals`,
      label: tnav('referrals'),
      icon: '🔁',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/storage`,
      label: tnav('storage'),
      icon: '🗄️',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/ops`,
      label: tnav('ops'),
      icon: '🛠️',
      roles: ['admin', 'superadmin'],
    },
    {
      href: `/${locale}/audit`,
      label: 'Audit',
      icon: '📜',
      roles: ['admin', 'superadmin'],
    },
  ] as const

  const adminLayoutProps = {
    isLoaded: isLoaded && auth.isLoaded,
    signOutButton: <SignOutButton />,
    children,
    pathname, // Pass pathname to AdminLayout
    userRole,
    navItems,
    ...(user && {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddresses: user.emailAddresses?.map((ea) => ({
          emailAddress: ea.emailAddress,
        })),
        publicMetadata: user.publicMetadata as Record<string, unknown>,
      },
    }),
  }

  return <AdminLayout {...adminLayoutProps} />
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider>
      <AuthProvider>
        <AdminLayoutWrapper>{children}</AdminLayoutWrapper>
      </AuthProvider>
    </ClerkProvider>
  )
}
