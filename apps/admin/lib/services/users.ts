import type { ListUsersParams } from '@/lib/server/users-service'
import type { AdminUser, Pagination } from '@elevate/types/admin-api-types'

export async function listUsers(params: ListUsersParams): Promise<{ users: AdminUser[]; pagination: Pagination }> {
  const mod = (await import('@/lib/server/users-service')) as {
    listUsersService: (
      p: ListUsersParams,
    ) => Promise<{ users: AdminUser[]; pagination: Pagination }>
  }
  return mod.listUsersService(params)
}
