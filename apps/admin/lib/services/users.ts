"use server"
import 'server-only'

import { listUsersService } from '@/lib/server/users-service'
import type { UsersQuery, AdminUser, Pagination } from '@elevate/types/admin-api-types'

type ListResult = { users: AdminUser[]; pagination: Pagination }

export async function listUsers(params: UsersQuery = {}): Promise<ListResult> {
  const page = Number(params.page ?? 1)
  const limit = Number(params.limit ?? 50)
  const sortBy = (params.sortBy as 'created_at' | 'name' | 'email') ?? 'created_at'
  const sortOrder = (params.sortOrder as 'asc' | 'desc') ?? 'desc'
  const args: Parameters<typeof listUsersService>[0] = { page, limit, sortBy, sortOrder, userType: 'ALL' }
  if (typeof params.search === 'string' && params.search) args.search = params.search
  if (typeof params.role === 'string' && params.role) args.role = params.role
  if (typeof params.cohort === 'string' && params.cohort) args.cohort = params.cohort
  return listUsersService(args)
}
