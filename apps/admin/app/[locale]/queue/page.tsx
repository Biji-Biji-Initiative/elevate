import { redirect } from 'next/navigation'
import { buildQueryString } from '@/lib/utils/query'

export default function Page() {
  const qs = buildQueryString({ status: 'PENDING' })
  redirect(`/admin/submissions?${qs}`)
}
