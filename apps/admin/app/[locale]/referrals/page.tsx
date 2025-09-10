'use client'

import React, { useEffect, useState } from 'react'

import { withRoleGuard } from '@elevate/auth/context'
import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'

type ReferralRow = {
  id: string
  eventType: string
  source?: string | null
  createdAt: string
  externalEventId?: string | null
  referrer: { id: string; name: string; email: string }
  referee: { id: string; name: string; email: string; user_type: 'EDUCATOR' | 'STUDENT' }
}

function ReferralsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [email, setEmail] = useState('')
  const [month, setMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (email) qs.set('email', email)
      if (month) qs.set('month', month)
      const res = await fetch(`/api/admin/referrals?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load')
      setRows(json.data?.referrals || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-gray-600">List of referral events and basic filters.</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700">Filter by Email</label>
              <Input placeholder="referrer or referee email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Month (YYYY-MM)</label>
              <Input placeholder="YYYY-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <Button onClick={fetchData} disabled={loading}>{loading ? 'Loading…' : 'Apply Filters'}</Button>
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
    </div>
  )
}

export default withRoleGuard(ReferralsPage, ['admin', 'superadmin'])

