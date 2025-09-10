"use client"

import React, { useState } from 'react'

import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'
import { fetchReferralsAction } from '@/lib/actions/referrals'

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
  const [month, setMonth] = useState<string>(initialMonth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchReferralsAction({ email, month })
      setRows(res.referrals as ReferralRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

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
              <label htmlFor="filter-email" className="block text-sm font-medium text-gray-700">Filter by Email</label>
              <Input id="filter-email" placeholder="referrer or referee email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="filter-month" className="block text-sm font-medium text-gray-700">Month (YYYY-MM)</label>
              <Input id="filter-month" placeholder="YYYY-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div>
              <Button onClick={() => void fetchData()} disabled={loading}>{loading ? 'Loading…' : 'Apply Filters'}</Button>
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

