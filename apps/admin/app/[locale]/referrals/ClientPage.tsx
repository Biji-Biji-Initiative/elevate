"use client"

import React, { useMemo, useState } from 'react'

import { fetchReferralsAction, fetchReferralsSummaryAction } from '@/lib/actions/referrals'
import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'
import { buildQueryString } from '@/lib/utils/query'

type ReferralRow = {
  id: string
  eventType: string
  source?: string | null
  createdAt: string
  externalEventId?: string | null
  referrer: { id: string; name: string; email: string }
  referee: { id: string; name: string; email: string; user_type: 'EDUCATOR' | 'STUDENT' }
}

export function ClientPage({ initialRows, initialMonth }: { initialRows: ReferralRow[]; initialMonth: string }) {
  const [rows, setRows] = useState<ReferralRow[]>(initialRows)
  const [email, setEmail] = useState('')
  const [referrerId, setReferrerId] = useState('')
  const [refereeId, setRefereeId] = useState('')
  const [month, setMonth] = useState<string>(initialMonth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ total: number; byType: { educators: number; students: number }; uniqueReferrers: number; pointsAwarded: number; topReferrers: Array<{ userId: string; points: number; user: { id: string; name: string; email: string; handle: string } }> } | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: { referrerId?: string; refereeId?: string; email?: string; month?: string } = {}
      if (email) params.email = email
      if (month) params.month = month
      if (referrerId) params.referrerId = referrerId
      if (refereeId) params.refereeId = refereeId
      const res = await fetchReferralsAction(params)
      setRows(res.referrals as ReferralRow[])
      const sum = await fetchReferralsSummaryAction(month)
      setSummary(sum)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const buildCsv = () => {
    const headers = ['when','event','source','referrer_name','referrer_email','referee_name','referee_email','referee_type','external_event_id']
    const toCell = (v: unknown) => {
      let s = String(v ?? '')
      const first = s.charAt(0)
      if (first && ['=', '+', '-', '@'].includes(first)) s = `'${s}`
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rowsCsv = rows.map(r => [
      new Date(r.createdAt).toISOString(),
      r.eventType,
      r.source ?? '',
      r.referrer.name,
      r.referrer.email,
      r.referee.name,
      r.referee.email,
      r.referee.user_type,
      r.externalEventId ?? '',
    ].map(toCell).join(',')).join('\n')
    const csv = [headers.join(','), rowsCsv].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `referrals_${month}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const buildServerExportUrl = () => {
    const qs = buildQueryString({ email: email || undefined, referrerId: referrerId || undefined, refereeId: refereeId || undefined, month: month || undefined })
    return `/api/admin/referrals/export.csv?${qs}`
  }

  const monthPresets = useMemo(() => {
    const d = new Date()
    const fmt = (yy: number, mm0: number) => `${yy}-${String(mm0 + 1).padStart(2, '0')}`
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    return [fmt(y, m), fmt(y, (m + 11) % 12), fmt(m === 0 ? y - 1 : y, (m + 10) % 12)]
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-gray-600">List of referral events and basic filters.</p>
      </div>
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Total Referrals</div><div className="text-2xl font-semibold">{summary.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Educator Referrals</div><div className="text-2xl font-semibold">{summary.byType.educators}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Student Referrals</div><div className="text-2xl font-semibold">{summary.byType.students}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Points Awarded</div><div className="text-2xl font-semibold">{summary.pointsAwarded}</div></CardContent></Card>
        </div>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <label htmlFor="filter-email" className="block text-sm font-medium text-gray-700">Filter by Email</label>
              <Input id="filter-email" placeholder="referrer or referee email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filter-referrer" className="block text-sm font-medium text-gray-700">Referrer ID</label>
              <Input id="filter-referrer" placeholder="user_..." value={referrerId} onChange={(e) => setReferrerId(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filter-referee" className="block text-sm font-medium text-gray-700">Referee ID</label>
              <Input id="filter-referee" placeholder="user_..." value={refereeId} onChange={(e) => setRefereeId(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filter-month" className="block text-sm font-medium text-gray-700">Month (YYYY-MM)</label>
              <Input id="filter-month" placeholder="YYYY-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
              <div className="flex gap-2 mt-1 text-xs">
                {monthPresets.map((mm) => (
                  <button key={mm} className="underline text-blue-600" onClick={(e) => { e.preventDefault(); setMonth(mm) }}>{mm}</button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void fetchData()} disabled={loading}>{loading ? 'Loading…' : 'Apply Filters'}</Button>
              <Button variant="ghost" onClick={buildCsv}>Export CSV</Button>
              <a href={buildServerExportUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded border hover:bg-gray-50">Server Export</a>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">Event</th>
                  <th className="text-left p-2">Referrer</th>
                  <th className="text-left p-2">Referee</th>
                  <th className="text-left p-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="p-2">{r.eventType}</td>
                    <td className="p-2">
                      <div className="font-medium">{r.referrer.name}</div>
                      <div className="text-gray-500">{r.referrer.email}</div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{r.referee.name}</div>
                      <div className="text-gray-500">{r.referee.email}</div>
                    </td>
                    <td className="p-2">{r.referee.user_type}</td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td className="p-6 text-center text-gray-500" colSpan={5}>No referrals found for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {summary && summary.topReferrers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-2">Top Referrers (Points)</h2>
            <div className="space-y-2">
              {summary.topReferrers.map((t) => (
                <div key={t.userId} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{t.user.name || t.user.handle || t.userId}</div>
                    <div className="text-gray-500">{t.user.email}</div>
                  </div>
                  <div className="font-semibold">{t.points}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
