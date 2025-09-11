'use client'

import React, { useState } from 'react'

import { getSloSummaryAction } from '@/lib/actions/slo'
import { toMsg } from '@/lib/errors'
import type { SLOSummary } from '@/lib/services/ops'
import { Button, Card, CardContent, Alert } from '@elevate/ui'

export default function OpsClient({ initial }: { initial: SLOSummary }) {
  const [summary, setSummary] = useState<SLOSummary | null>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSloSummaryAction()
      setSummary(data as SLOSummary)
    } catch (e: unknown) {
      setError(toMsg('SLO refresh', e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations</h1>
        <p className="text-gray-600 mt-2">SLO summary and operational status.</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div>
        <Button onClick={() => void fetchSummary()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
      </div>

      {summary && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {summary.breaching_slos > 0 && (
              <Alert>
                {summary.breaching_slos} SLO{summary.breaching_slos > 1 ? 's' : ''} breaching. Investigate recent failures or latency.
              </Alert>
            )}
            <div className="text-sm text-gray-700">Timestamp: {new Date(summary.timestamp).toLocaleString()}</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded border bg-white"><div className="text-sm text-gray-600">Total SLOs</div><div className="text-2xl font-bold">{summary.total_slos}</div></div>
              <div className="p-4 rounded border bg-white"><div className="text-sm text-gray-600">Healthy</div><div className="text-2xl font-bold text-green-600">{summary.healthy_slos}</div></div>
              <div className="p-4 rounded border bg-white"><div className="text-sm text-gray-600">Breaching</div><div className="text-2xl font-bold text-red-600">{summary.breaching_slos}</div></div>
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">SLO</th>
                    <th className="text-left p-2">Current</th>
                    <th className="text-left p-2">Target</th>
                    <th className="text-left p-2">Threshold</th>
                    <th className="text-left p-2">Trend</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Metrics</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.slos).map(([name, s]) => (
                    <tr key={name} className="border-b">
                      <td className="p-2 font-mono">{name}</td>
                      <td className="p-2">{s.current.toFixed(2)}%</td>
                      <td className="p-2">{s.target}%</td>
                      <td className="p-2">{s.threshold}%</td>
                      <td className="p-2 capitalize">{s.trend}</td>
                      <td className="p-2"><span className={`px-2 py-1 rounded text-xs ${s.breaching ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{s.breaching ? 'Breaching' : 'Healthy'}</span></td>
                      <td className="p-2">{s.metrics_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
