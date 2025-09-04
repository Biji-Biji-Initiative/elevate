/**
 * RLS (Row Level Security) Context Helper
 * Provides utilities to set user context for RLS policies
 * 
 * PostgreSQL RLS policies can access session variables via current_setting()
 * This module provides type-safe helpers to set these variables
 */

import { Role } from '@prisma/client'

import { prisma } from './client'

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * User context for RLS policies
 */
export interface UserContext {
  userId: string
  role: Role
  cohort?: string
  school?: string
}

/**
 * Extended context with additional metadata
 */
export interface ExtendedUserContext extends UserContext {
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

/**
 * Context transaction callback
 */
export type ContextCallback<T> = () => Promise<T>

// =============================================================================
// CORE CONTEXT FUNCTIONS  
// =============================================================================

/**
 * Set user context variables for the current database session
 * These variables are used by RLS policies to enforce access control
 */
export async function setUserContext(context: UserContext): Promise<void> {
  await prisma.$executeRaw`
    SELECT 
      set_config('app.user_id', ${context.userId}, true),
      set_config('app.user_role', ${context.role}, true),
      set_config('app.user_cohort', ${context.cohort || ''}, true),
      set_config('app.user_school', ${context.school || ''}, true)
  `
}

/**
 * Set extended user context with additional metadata
 */
export async function setExtendedUserContext(
  context: ExtendedUserContext,
): Promise<void> {
  await prisma.$executeRaw`
    SELECT 
      set_config('app.user_id', ${context.userId}, true),
      set_config('app.user_role', ${context.role}, true),
      set_config('app.user_cohort', ${context.cohort || ''}, true),
      set_config('app.user_school', ${context.school || ''}, true),
      set_config('app.session_id', ${context.sessionId || ''}, true),
      set_config('app.ip_address', ${context.ipAddress || ''}, true),
      set_config('app.user_agent', ${context.userAgent || ''}, true),
      set_config('app.request_id', ${context.requestId || ''}, true)
  `
}

/**
 * Clear all user context variables
 */
export async function clearUserContext(): Promise<void> {
  await prisma.$executeRaw`
    SELECT 
      set_config('app.user_id', null, true),
      set_config('app.user_role', null, true),
      set_config('app.user_cohort', null, true),
      set_config('app.user_school', null, true),
      set_config('app.session_id', null, true),
      set_config('app.ip_address', null, true),
      set_config('app.user_agent', null, true),
      set_config('app.request_id', null, true)
  `
}

/**
 * Get current user context from session variables
 */
export async function getUserContext(): Promise<UserContext | null> {
  const result = await prisma.$queryRaw<
    Array<{
      user_id: string | null
      user_role: string | null
      user_cohort: string | null
      user_school: string | null
    }>
  >`
    SELECT 
      current_setting('app.user_id', true) as user_id,
      current_setting('app.user_role', true) as user_role,
      current_setting('app.user_cohort', true) as user_cohort,
      current_setting('app.user_school', true) as user_school
  `

  const row = result[0]
  if (!row?.user_id || !row?.user_role) {
    return null
  }

  const context: UserContext = {
    userId: row.user_id,
    role: row.user_role as Role,
  }
  
  if (row.user_cohort) {
    context.cohort = row.user_cohort
  }
  
  if (row.user_school) {
    context.school = row.user_school
  }
  
  return context
}

// =============================================================================
// TRANSACTION WRAPPER WITH CONTEXT
// =============================================================================

/**
 * Execute a callback within a transaction with user context set
 * Context is automatically applied and cleaned up
 */
export async function withUserContext<T>(
  context: UserContext,
  callback: ContextCallback<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set user context for this transaction
    await tx.$executeRaw`
      SELECT 
        set_config('app.user_id', ${context.userId}, true),
        set_config('app.user_role', ${context.role}, true),
        set_config('app.user_cohort', ${context.cohort || ''}, true),
        set_config('app.user_school', ${context.school || ''}, true)
    `

    // Execute the callback with context set
    return callback()
  })
}

/**
 * Execute a callback with extended user context
 */
export async function withExtendedUserContext<T>(
  context: ExtendedUserContext,
  callback: ContextCallback<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Set extended user context for this transaction
    await tx.$executeRaw`
      SELECT 
        set_config('app.user_id', ${context.userId}, true),
        set_config('app.user_role', ${context.role}, true),
        set_config('app.user_cohort', ${context.cohort || ''}, true),
        set_config('app.user_school', ${context.school || ''}, true),
        set_config('app.session_id', ${context.sessionId || ''}, true),
        set_config('app.ip_address', ${context.ipAddress || ''}, true),
        set_config('app.user_agent', ${context.userAgent || ''}, true),
        set_config('app.request_id', ${context.requestId || ''}, true)
    `

    return callback()
  })
}

// =============================================================================
// ADMIN CONTEXT HELPERS
// =============================================================================

/**
 * Execute operations with admin context (bypasses most RLS policies)
 */
export async function withAdminContext<T>(
  adminUserId: string,
  callback: ContextCallback<T>,
): Promise<T> {
  return withUserContext(
    {
      userId: adminUserId,
      role: Role.ADMIN,
    },
    callback,
  )
}

/**
 * Execute operations with superadmin context (bypasses all RLS policies)
 */
export async function withSuperadminContext<T>(
  superadminUserId: string,
  callback: ContextCallback<T>,
): Promise<T> {
  return withUserContext(
    {
      userId: superadminUserId,
      role: Role.SUPERADMIN,
    },
    callback,
  )
}

// =============================================================================
// CONTEXT VALIDATION HELPERS
// =============================================================================

/**
 * Validate that current context has required role
 */
export async function requireRole(requiredRole: Role): Promise<void> {
  const context = await getUserContext()
  if (!context) {
    throw new Error('No user context set')
  }

  if (context.role !== requiredRole) {
    throw new Error(`Required role: ${requiredRole}, current role: ${context.role}`)
  }
}

/**
 * Validate that current context has minimum role level
 */
export async function requireMinimumRole(minimumRole: Role): Promise<void> {
  const context = await getUserContext()
  if (!context) {
    throw new Error('No user context set')
  }

  const roleHierarchy: Record<Role, number> = {
    PARTICIPANT: 1,
    REVIEWER: 2,
    ADMIN: 3,
    SUPERADMIN: 4,
  }

  const currentLevel = roleHierarchy[context.role]
  const requiredLevel = roleHierarchy[minimumRole]

  if (currentLevel < requiredLevel) {
    throw new Error(
      `Insufficient role level. Required: ${minimumRole} (${requiredLevel}), current: ${context.role} (${currentLevel})`,
    )
  }
}

/**
 * Check if current user can access resources from a specific cohort
 */
export async function canAccessCohort(targetCohort: string): Promise<boolean> {
  const context = await getUserContext()
  if (!context) {
    return false
  }

  // Admins and superadmins can access any cohort
  if (context.role === Role.ADMIN || context.role === Role.SUPERADMIN) {
    return true
  }

  // Participants and reviewers can only access their own cohort
  return context.cohort === targetCohort
}

/**
 * Check if current user can access resources from a specific school
 */
export async function canAccessSchool(targetSchool: string): Promise<boolean> {
  const context = await getUserContext()
  if (!context) {
    return false
  }

  // Admins and superadmins can access any school
  if (context.role === Role.ADMIN || context.role === Role.SUPERADMIN) {
    return true
  }

  // Participants and reviewers can only access their own school
  return context.school === targetSchool
}

// =============================================================================
// MIDDLEWARE INTEGRATION HELPERS
// =============================================================================

/**
 * Extract user context from Clerk auth
 * This would typically be used in API middleware
 */
export function extractContextFromClerk(clerkUser: {
  id: string
  publicMetadata?: { role?: string; cohort?: string | null; school?: string | null }
}): UserContext {
  const base: UserContext = {
    userId: clerkUser.id,
    role: (clerkUser.publicMetadata?.role as Role) || Role.PARTICIPANT,
  }
  const cohort = clerkUser.publicMetadata?.cohort ?? undefined
  const school = clerkUser.publicMetadata?.school ?? undefined
  if (typeof cohort === 'string') base.cohort = cohort
  if (typeof school === 'string') base.school = school
  return base
}

/**
 * Extract extended context from request
 */
export function extractExtendedContextFromRequest(
  clerkUser: {
    id: string
    publicMetadata?: { role?: string; cohort?: string | null; school?: string | null }
  },
  request: { headers?: Record<string, string | undefined>; ip?: string },
): ExtendedUserContext {
  const base = extractContextFromClerk(clerkUser) as ExtendedUserContext
  const sessionId = request.headers?.['x-session-id']
  const ip = request.headers?.['x-forwarded-for'] ?? request.ip
  const userAgent = request.headers?.['user-agent']
  const requestId = request.headers?.['x-request-id']
  if (sessionId) base.sessionId = sessionId
  if (ip) base.ipAddress = ip
  if (userAgent) base.userAgent = userAgent
  if (requestId) base.requestId = requestId
  return base
}

// =============================================================================
// AUDIT LOGGING WITH CONTEXT
// =============================================================================

/**
 * Log an audit event with current user context
 */
export async function logAuditEvent(
  action: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const context = await getUserContext()
  if (!context) {
    throw new Error('Cannot log audit event without user context')
  }

  await prisma.auditLog.create({
    data: {
      actor_id: context.userId,
      action,
      target_id: targetId ?? null,
      meta: {
        ...metadata,
        user_role: context.role,
        user_cohort: context.cohort ?? null,
        user_school: context.school ?? null,
        timestamp: new Date().toISOString(),
      },
    },
  })
}

// =============================================================================
// DEBUGGING AND DEVELOPMENT HELPERS
// =============================================================================

/**
 * Debug: print current session context
 * Only available in development
 */
export async function debugContext(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  // Intentionally no logging in library code to avoid console usage
  await getUserContext()
}

/**
 * Test helper: set test context
 */
export async function setTestContext(
  userId = 'test-user-id',
  role: Role = 'PARTICIPANT',
  cohort?: string,
  school?: string,
): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test context cannot be set in production')
  }

  const context: UserContext = {
    userId,
    role,
  }
  
  if (cohort) {
    context.cohort = cohort
  }
  
  if (school) {
    context.school = school
  }
  
  await setUserContext(context)
}

/**
 * Test helper: clear test context
 */
export async function clearTestContext(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test context cannot be cleared in production')
  }

  await clearUserContext()
}
