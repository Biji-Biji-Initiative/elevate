import { listSubmissions, getCohorts } from '@/lib/services/submissions'
import { toSubmissionRowUI } from '@/lib/ui-types'

import { ClientPage } from './ClientPage'

export default async function Page() {
  const [cohorts, list] = await Promise.all([
    getCohorts().catch(() => []),
    listSubmissions({
      page: 1,
      limit: 50,
      sortBy: 'created_at',
      sortOrder: 'desc',
      status: 'PENDING',
    }),
  ])

  const initialRows = list.submissions.map(toSubmissionRowUI)
  const initialPagination = list.pagination

  return (
    <ClientPage
      initialRows={initialRows}
      initialPagination={initialPagination}
      initialCohorts={cohorts}
    />
  )
}
