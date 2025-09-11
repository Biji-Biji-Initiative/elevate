import { getCohorts } from '@/lib/services/submissions'

import { ClientPage } from './ClientPage'

export default async function Page() {
  const cohorts = await getCohorts().catch(() => [])
  return <ClientPage initialCohorts={cohorts} />
}
