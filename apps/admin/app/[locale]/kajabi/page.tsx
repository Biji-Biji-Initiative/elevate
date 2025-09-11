import { getKajabiList } from '@/lib/services/kajabi'

import { ClientPage } from './ClientPage'

export default async function Page() {
  const { events, stats } = await getKajabiList()
  return <ClientPage initialEvents={events} initialStats={stats} />
}
