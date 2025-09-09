'use client'

import type { ReactNode } from 'react'

import { useUser, SignOutButton, ClerkProvider } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

import { AuthProvider } from '@elevate/auth/context'
import { AdminLayout } from '@elevate/ui/next'

interface ProvidersProps {
  children: ReactNode
}

function AdminLayoutWrapper({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  
  const adminLayoutProps = {
    isLoaded,
    signOutButton: <SignOutButton />,
    children,
    pathname, // Pass pathname to AdminLayout
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
