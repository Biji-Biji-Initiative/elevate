import { listBadges } from '@/lib/services/badges'
import { listUsers } from '@/lib/services/users'
import { toBadgeUI } from '@/lib/ui-types'

import BadgesClient from './ClientPage'

export default async function BadgesPage() {
  const [{ badges }, usersResp] = await Promise.all([
    listBadges(true),
    listUsers({ page: 1, limit: 1000, sortBy: 'created_at', sortOrder: 'desc' }).catch(() => ({ users: [], pagination: { page: 1, limit: 1000, total: 0, pages: 0 } })),
  ])

  const initialBadges = badges.map(toBadgeUI)
  const initialUsers = usersResp.users ?? []

  return <BadgesClient initialBadges={initialBadges} initialUsers={initialUsers} />
}
