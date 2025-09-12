import type { ListUsersParams } from '@/lib/server/users-service'
import type { AdminUser, Pagination } from '@elevate/types/admin-api-types'

export async function listUsers(params: ListUsersParams): Promise<{ users: AdminUser[]; pagination: Pagination }> {
  const mod = await import('@/lib/server/users-service')
  return mod.listUsersService(params)
}
