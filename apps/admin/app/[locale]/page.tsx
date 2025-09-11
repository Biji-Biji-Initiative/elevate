import { getAnalytics } from '@/lib/services/analytics'
import { getCohorts } from '@/lib/services/submissions'

import ClientPage from './ClientPage'

export default async function Page() {
  const [initialCohorts, initialAnalytics] = await Promise.all([
    getCohorts().catch(() => []),
    getAnalytics({}).catch(() => null),
  ])

  return (
    <ClientPage initialAnalytics={initialAnalytics} initialCohorts={initialCohorts} />
  )
}
