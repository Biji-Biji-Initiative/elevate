'use client'

import { useUser, SignOutButton } from '@clerk/nextjs'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthProvider } from '@elevate/auth/context'
import { AdminLayout } from '@elevate/ui'

interface ProvidersProps {
  children: React.ReactNode
}

function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  
  const adminLayoutProps = {
    isLoaded,
    signOutButton: <SignOutButton />,
    children,
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