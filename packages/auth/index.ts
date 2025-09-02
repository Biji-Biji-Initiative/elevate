// Server-side auth utilities
export {
  getCurrentUser,
  requireRole,
  hasRole,
  hasAnyRole,
  hasPermission,
  normalizeRole,
  withRoleProtection,
  RoleError,
  ROLE_PERMISSIONS,
  type RoleName,
  type AuthUser,
  type Permission,
} from './withRole'

export {
  createProtectedApiHandler,
  createProtectedAction,
  validateAuth,
  createErrorResponse,
} from './server-helpers'

// Client-side auth utilities
export {
  AuthProvider,
  useAuth,
  useRequireAuth,
  RoleGuard,
  PermissionGuard,
  withRoleGuard,
} from './context'