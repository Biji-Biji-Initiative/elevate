import { listAuditLogsService } from '@/lib/server/audit-service'
import { buildQueryString } from '@/lib/utils/query'

type _Log = { id: string; actor_id: string; action: string; target_id: string | null; created_at: string; meta?: unknown }

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams
  const toStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const params: Parameters<typeof listAuditLogsService>[0] = { limit: 100 }
  const targetId = toStr(sp?.targetId)
  const actorId = toStr(sp?.actorId)
  const action = toStr(sp?.action)
  const startDate = toStr(sp?.startDate)
  const endDate = toStr(sp?.endDate)
  if (targetId) params.targetId = targetId
  if (actorId) params.actorId = actorId
  if (action) params.action = action
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate
  const logs = (await listAuditLogsService(params)).logs
  // Presets for convenience (computed on server)
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const daysAgo = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - n))
  const last7 = { start: iso(daysAgo(7)), end: iso(today) }
  const last30 = { start: iso(daysAgo(30)), end: iso(today) }
  const todayOnly = { start: iso(today), end: iso(today) }
  const mkPresetUrl = (start: string, end: string) => {
    const qs = buildQueryString({
      targetId: typeof sp?.targetId === 'string' ? sp.targetId : undefined,
      actorId: typeof sp?.actorId === 'string' ? sp.actorId : undefined,
      action: typeof sp?.action === 'string' ? sp.action : undefined,
      startDate: start,
      endDate: end,
    })
    return `?${qs}`
  }
  const buildServerExportUrl = () => {
    const qs = buildQueryString({
      targetId: typeof sp?.targetId === 'string' ? sp.targetId : undefined,
      actorId: typeof sp?.actorId === 'string' ? sp.actorId : undefined,
      action: typeof sp?.action === 'string' ? sp.action : undefined,
      startDate: typeof sp?.startDate === 'string' ? sp.startDate : undefined,
      endDate: typeof sp?.endDate === 'string' ? sp.endDate : undefined,
    })
    return `/api/admin/audit/export.csv?${qs}`
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Audit Logs</h1>
        <p className="text-sm text-gray-600 mb-6">Filter by appending query params: <code>?targetId=...&action=...&actorId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD</code></p>
        <div className="flex items-center gap-2 mb-4">
          <a href={mkPresetUrl(last7.start, last7.end)} className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50">Last 7 days</a>
          <a href={mkPresetUrl(last30.start, last30.end)} className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50">Last 30 days</a>
          <a href={mkPresetUrl(todayOnly.start, todayOnly.end)} className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50">Today</a>
          <a href={buildServerExportUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50">Server Export</a>
        </div>
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Actor</th>
                <th className="text-left px-3 py-2">Target</th>
                <th className="text-left px-3 py-2">Meta</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{l.action}</td>
                  <td className="px-3 py-2">{l.actor_id}</td>
                  <td className="px-3 py-2">{l.target_id || '—'}</td>
                  <td className="px-3 py-2 max-w-[480px]">
                    <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(l.meta ?? {}, null, 2)}</pre>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
