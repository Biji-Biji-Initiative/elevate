import { listReferrals } from '@/lib/services/referrals'

import { ClientPage } from './ClientPage'

export default async function Page() {
  const d = new Date()
  const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const { referrals } = await listReferrals({ month })
  return <ClientPage initialRows={referrals} initialMonth={month} />
}
