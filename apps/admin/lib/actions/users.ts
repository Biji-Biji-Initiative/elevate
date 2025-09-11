'use server'
import { listUsersService, updateUserService, bulkUpdateUsersService, type ListUsersParams } from '@/lib/server/users-service'
import { mergeOptional, isOneOf, nonEmptyString } from '@/lib/utils/param-builder'
import type { AdminUser, Pagination } from '@elevate/types/admin-api-types'

export async function updateUserAction(body: {
  userId: string
  role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  school?: string | null
  cohort?: string | null
  name?: string
  handle?: string
}): Promise<{ message: string; user: AdminUser }>
{
  return updateUserService(body)
}

export async function bulkUpdateUsersAction(body: {
  userIds: string[]
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
}): Promise<{ processed: number; failed: number; errors: Array<{ userId: string; error: string }> }>
{
  return bulkUpdateUsersService(body)
}

type ListUsersQuery = {
  page?: number | string
  limit?: number | string
  sortBy?: 'created_at' | 'name' | 'email' | string
  sortOrder?: 'asc' | 'desc' | string
  search?: string
  role?: ListUsersParams['role'] | string
  userType?: ListUsersParams['userType'] | string
  cohort?: string
}

export async function listUsersAction(query: ListUsersQuery)
  : Promise<{ users: AdminUser[]; pagination: Pagination }>
{
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? 20)
  const paramsBase: ListUsersParams = {
    page,
    limit,
    sortBy: (query.sortBy as 'created_at' | 'name' | 'email') || 'created_at',
    sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
  }
  let params = paramsBase
  if (nonEmptyString(query.search)) params = mergeOptional(params, 'search', query.search)
  if (isOneOf(query.role, ['ALL','PARTICIPANT','REVIEWER','ADMIN','SUPERADMIN'] as const)) params = mergeOptional(params, 'role', query.role)
  if (isOneOf(query.userType, ['ALL','EDUCATOR','STUDENT'] as const)) params = mergeOptional(params, 'userType', query.userType)
  if (nonEmptyString(query.cohort)) params = mergeOptional(params, 'cohort', query.cohort)
  return listUsersService(params)
}

export async function bulkUpdateLeapsUsersAction(body: {
  userIds: string[]
  userType?: 'EDUCATOR' | 'STUDENT'
  userTypeConfirmed?: boolean
  school?: string
  region?: string
}): Promise<{ processed: number; failed: number; errors: Array<{ userId: string; error: string }> }>
{
  const { bulkUpdateLeapsUsersService } = await import('@/lib/server/users-service')
  return bulkUpdateLeapsUsersService(body)
}

export async function updateLeapsUserAction(body: {
  userId: string
  userType?: 'EDUCATOR' | 'STUDENT'
  userTypeConfirmed?: boolean
  school?: string
  region?: string
}): Promise<{ message: string }>
{
  'use server'
  const { bulkUpdateLeapsUsersService } = await import('@/lib/server/users-service')
  const { userId, userType, userTypeConfirmed, school, region } = body
  const payload: { userIds: string[]; userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean; school?: string; region?: string } = { userIds: [userId] }
  if (userType) payload.userType = userType
  if (typeof userTypeConfirmed === 'boolean') payload.userTypeConfirmed = userTypeConfirmed
  if (school !== undefined) payload.school = school
  if (region !== undefined) payload.region = region
  await bulkUpdateLeapsUsersService(payload)
  return { message: 'Saved' }
}
