import { getUserLeapsProfileService } from '@/lib/server/users-service'
import { buildQueryString } from '@/lib/utils/query'

import AdminUserLeapsClient from './ClientPage'

export default async function AdminUserLeapsPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params
  try {
    const user = await getUserLeapsProfileService(id)
    return (
      <main style={{ padding: 24 }}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Manage LEAPS Profile</h1>
            <div className="flex items-center gap-2 text-sm">
              <a href={`../audit?${buildQueryString({ targetId: id })}`} className="inline-flex items-center px-3 py-2 rounded border hover:bg-gray-50">Audit Logs</a>
              <a href={`/api/admin/audit/export.csv?${buildQueryString({ targetId: id })}`} className="inline-flex items-center px-3 py-2 rounded border hover:bg-gray-50">Server Export</a>
            </div>
          </div>
          <AdminUserLeapsClient user={user} />
        </div>
      </main>
    )
  } catch {
    return (
      <main style={{ padding: 24 }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">User</h1>
          <p className="text-red-600 mt-4">Failed to load user.</p>
        </div>
      </main>
    )
  }
}
