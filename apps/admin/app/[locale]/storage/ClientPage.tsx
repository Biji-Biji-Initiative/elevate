'use client'

import React, { useState } from 'react'

import { enforceStorageRetentionAction } from '@/lib/actions/storage'
import { toMsg } from '@/lib/errors'
import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'

export default function StorageClient() {
  const [userId, setUserId] = useState('')
  const [days, setDays] = useState('730')
  const [result, setResult] = useState<{ userId: string; days: number; deleted: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onEnforce = async () => {
    if (!userId) {
      setError('User ID is required')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await enforceStorageRetentionAction({ userId, days: Number(days) })
      setResult(res)
    } catch (e: unknown) {
      setError(toMsg('Retention', e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Storage</h1>
        <p className="text-gray-600 mt-2">Manage evidence retention policies.</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Enforce Retention</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
            <Input placeholder="Days (default 730)" value={days} onChange={(e) => setDays(e.target.value)} />
            <Button onClick={() => void onEnforce()} disabled={loading || !userId}>{loading ? 'Enforcing…' : 'Enforce'}</Button>
          </div>
          <div className="flex gap-2 text-xs text-gray-600">
            Quick set:
            <Button variant="secondary" onClick={() => setDays('365')}>365</Button>
            <Button variant="secondary" onClick={() => setDays('730')}>730</Button>
          </div>
          {result && (
            <Alert>Deleted {result.deleted} files older than {result.days} days for user {result.userId}.</Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
