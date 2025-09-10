'use client'

import { useState } from 'react'

import { useTranslations } from 'next-intl'

import { adminActions } from '@elevate/admin-core'
import { withRoleGuard } from '@elevate/auth/context'
import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'

function StoragePage() {
  const t = useTranslations('storage')
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
      const res = await adminActions.enforceStorageRetention({ userId, days: Number(days) })
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? `Retention: ${e.message}` : 'Retention: Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-gray-600 mt-2">Manage evidence retention policies.</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('enforce')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder={t('user_id')} value={userId} onChange={(e) => setUserId(e.target.value)} />
            <Input placeholder={`${t('days')} (default 730)`} value={days} onChange={(e) => setDays(e.target.value)} />
            <Button onClick={onEnforce} disabled={loading || !userId}>{loading ? 'Enforcing…' : t('enforce')}</Button>
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

export default withRoleGuard(StoragePage, ['admin', 'superadmin'])
