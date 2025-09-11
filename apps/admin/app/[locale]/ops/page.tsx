import { getSloSummary } from '@/lib/services/ops'

import OpsClient from './ClientPage'

export default async function Page() {
  const initial = await getSloSummary().catch(() => ({
    timestamp: new Date().toISOString(),
    total_slos: 0,
    breaching_slos: 0,
    healthy_slos: 0,
    slos: {},
  }))
  return <OpsClient initial={initial} />
}
