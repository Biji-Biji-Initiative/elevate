import { listUsers } from '@/lib/services/users'
import { getCohorts } from '@/lib/services/submissions'

import { toUserUI } from '@/lib/ui-types'
import UsersClient from './ClientPage'

export default async function UsersPage() {
  const page = 1
  const limit = 50
  const sortBy = 'created_at' as const
  const sortOrder = 'desc' as const

  const [{ users, pagination }, cohorts] = await Promise.all([
    listUsers({ page, limit, sortBy, sortOrder }),
    getCohorts().catch(() => [] as string[]),
  ])

  const initialUsers = users.map(toUserUI)
  const initialPagination = {
    page: pagination.page ?? page,
    limit: pagination.limit ?? limit,
    total: pagination.total ?? 0,
    pages: pagination.pages ?? Math.ceil((pagination.total ?? 0) / (pagination.limit ?? limit)),
  }

  return (
    <UsersClient
      initialUsers={initialUsers}
      initialCohorts={cohorts}
      initialPagination={initialPagination}
    />
  )
}
