'use client'

import { useUser } from '@clerk/nextjs'
import React, { createContext, useContext, ReactNode } from 'react'
import { normalizeRole, hasRole, hasPermission, RoleName, Permission } from './types'

interface AuthContextValue {
  isLoaded: boolean
  isSignedIn: boolean
  userId?: string
  email?: string
  name?: string
  role: RoleName
  hasRole: (requiredRole: RoleName) => boolean
  hasPermission: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoaded, isSignedIn, user } = useUser()
  
  const userId = user?.id
  const email = user?.emailAddresses?.[0]?.emailAddress
  const name = user?.fullName || undefined
  const role = normalizeRole((user?.publicMetadata as Record<string, unknown>)?.role as string)

  const contextValue: AuthContextValue = {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    userId,
    email,
    name,
    role,
    hasRole: (requiredRole: RoleName) => hasRole(role, requiredRole),
    hasPermission: (permission: Permission) => hasPermission(role, permission),
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 * @returns Auth context value
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to require authentication
 * @param minRole Optional minimum role required
 * @returns Auth context value if authenticated
 * @throws Error if not authenticated or insufficient role
 */
export function useRequireAuth(minRole?: RoleName): AuthContextValue {
  const auth = useAuth()
  
  if (!auth.isLoaded) {
    throw new Error('Auth not loaded')
  }
  
  if (!auth.isSignedIn) {
    throw new Error('Authentication required')
  }
  
  if (minRole && !auth.hasRole(minRole)) {
    throw new Error(`Requires ${minRole} role or higher`)
  }
  
  return auth
}

/**
 * Component that renders children only if user has required role
 */
interface RoleGuardProps {
  role: RoleName
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const auth = useAuth()
  
  if (!auth.isLoaded) {
    return <div>Loading...</div>
  }
  
  if (!auth.isSignedIn || !auth.hasRole(role)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Component that renders children only if user has required permission
 */
interface PermissionGuardProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const auth = useAuth()
  
  if (!auth.isLoaded) {
    return <div>Loading...</div>
  }
  
  if (!auth.isSignedIn || !auth.hasPermission(permission)) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * Higher-order component that wraps a component with role-based access control
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: RoleName[]
) {
  return function ProtectedComponent(props: P) {
    const auth = useAuth()
    
    if (!auth.isLoaded) {
      return <div>Loading...</div>
    }
    
    if (!auth.isSignedIn) {
      return <div>Please sign in to access this page.</div>
    }
    
    if (!requiredRoles.some(role => auth.hasRole(role))) {
      return <div>You don't have permission to access this page.</div>
    }
    
    return <Component {...props} />
  }
}