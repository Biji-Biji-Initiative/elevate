'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

import { toMsg } from '@/lib/errors'
import { adminActions } from '@elevate/admin-core'
import { withRoleGuard } from '@elevate/auth/context'
import type { KajabiEvent, KajabiStats } from '@elevate/types/admin-api-types'
import { Button, Card, CardContent, Input, Alert } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'

 

function KajabiPage() {
  const t = useTranslations('kajabi')
  const [events, setEvents] = useState<KajabiEvent[]>([])
  const [stats, setStats] = useState<KajabiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message?: string
    test_mode?: boolean
    data?: Record<string, unknown>
  } | null>(null)
  const [testStarted, setTestStarted] = useState(false)
  const [reprocessMessage, setReprocessMessage] = useState<string | null>(null)

  // Health & Invite states
  const [health, setHealth] = useState<{
    healthy: boolean
    hasKey: boolean
    hasSecret: boolean
  } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteOfferId, setInviteOfferId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    invited: boolean
    contactId?: number
    withOffer: boolean
  } | null>(null)

  const fetchKajabiData = useCallback(async () => {
    setError(null)
    try {
      const data = await adminActions.getKajabi()
      setEvents(data.events)
      setStats(data.stats)
    } catch (error: unknown) {
      setError(toMsg('Kajabi fetch', error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchKajabiData()
  }, [fetchKajabiData])

  const handleTestWebhook = async () => {
    if (!testEmail) {
      setError('Please enter an email address')
      return
    }

    setTestLoading(true)
    setTestStarted(true)
    setTestResult(null)
    setError(null)

    try {
      const res = await adminActions.testKajabi({
        user_email: testEmail,
        course_name: 'Test Course - Admin Console',
      })
      setTestResult({
        success: true,
        ...(res && typeof res === 'object'
          ? { data: res as Record<string, unknown> }
          : {}),
      })
      await fetchKajabiData()
    } catch (error: unknown) {
      setError(toMsg('Kajabi test', error))
    } finally {
      setTestLoading(false)
      setTestStarted(false)
    }
  }

  const handleReprocess = async (eventId: string) => {
    try {
      setReprocessMessage(t('reprocess_started'))
      await adminActions.reprocessKajabi({ event_id: eventId })
      await fetchKajabiData()
      setReprocessMessage(
        t('reprocess_success', { id: eventId.substring(0, 8) }),
      )
    } catch (error: unknown) {
      setError(toMsg('Kajabi reprocess', error))
    }
  }

  const handleHealthCheck = async () => {
    try {
      const res = await adminActions.getKajabiHealth()
      setHealth(res)
    } catch (error: unknown) {
      setError(toMsg('Kajabi health', error))
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail && !inviteUserId) {
      setError('Provide either userId or email')
      return
    }
    setInviteLoading(true)
    setInviteResult(null)
    setError(null)
    try {
      const body: {
        userId?: string
        email?: string
        name?: string
        offerId?: string | number
      } = {}
      if (inviteUserId) body.userId = inviteUserId
      if (inviteEmail) body.email = inviteEmail
      if (inviteName) body.name = inviteName
      if (inviteOfferId) body.offerId = inviteOfferId
      const res = await adminActions.inviteKajabi(body)
      setInviteResult(res)
    } catch (error: unknown) {
      setError(toMsg('Kajabi invite', error))
    } finally {
      setInviteLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  // Type guard for safe payload access in table rendering
  function isKajabiPayload(value: unknown): value is {
    contact?: { email?: string }
    tag?: { name?: string }
  } {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    const contact = v['contact']
    const tag = v['tag']
    const hasContactEmail =
      !contact ||
      (typeof contact === 'object' &&
        contact !== null &&
        ('email' in (contact as Record<string, unknown>) || true))
    const hasTagName =
      !tag ||
      (typeof tag === 'object' &&
        tag !== null &&
        ('name' in (tag as Record<string, unknown>) || true))
    return hasContactEmail && hasTagName
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kajabi Integration</h1>
        <p className="text-gray-600 mt-2">
          Manage Kajabi webhook events and automatic Learn stage crediting
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Events</div>
              <div className="text-2xl font-bold">{stats.total_events}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Processed</div>
              <div className="text-2xl font-bold text-green-600">
                {stats.processed_events}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Matched Users</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.matched_users}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Unmatched</div>
              <div className="text-2xl font-bold text-orange-600">
                {stats.unmatched_events}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Points Awarded</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.points_awarded}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Webhook */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Test Webhook</h2>
          <div className="flex gap-4">
            <Input
              type="email"
              placeholder="Enter user email to test"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleTestWebhook}
              disabled={testLoading || !testEmail}
            >
              {testLoading ? 'Testing...' : 'Send Test Event'}
            </Button>
          </div>

          {testStarted && (
            <div className="mt-4">
              <Alert>{t('test_started')}</Alert>
            </div>
          )}

          {testResult && (
            <div className="mt-4">
              <Alert>
                {t('test_success_header')}
                <pre className="text-xs mt-2">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health & Invitation */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('health_invitation')}</h2>
          <div className="flex gap-3 items-center">
            <Button onClick={handleHealthCheck} variant="secondary">
              {t('check_health')}
            </Button>
            {health && (
              <Alert>
                {t('status_line', {
                  status: health.healthy ? 'Healthy' : 'Unhealthy',
                  key: health.hasKey ? '✅' : '❌',
                  secret: health.hasSecret ? '✅' : '❌',
                })}
              </Alert>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder={t('user_id_optional')}
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
            />
            <Input
              placeholder={t('email_optional')}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Input
              placeholder={t('name_optional')}
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
            <Input
              placeholder={t('offer_id_optional')}
              value={inviteOfferId}
              onChange={(e) => setInviteOfferId(e.target.value)}
            />
          </div>
          <div>
            <Button
              onClick={handleInvite}
              disabled={inviteLoading || (!inviteEmail && !inviteUserId)}
            >
              {inviteLoading ? 'Sending…' : t('send_invite')}
            </Button>
          </div>
          {inviteResult && (
            <Alert>
              {t('invite_success')} Contact ID: {inviteResult.contactId ?? '—'};
              Offer granted: {inviteResult.withOffer ? 'Yes' : 'No'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      {reprocessMessage && <Alert>{reprocessMessage}</Alert>}

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Event ID</th>
                  <th className="text-left p-2">Received</th>
                  <th className="text-left p-2">User Email</th>
                  <th className="text-left p-2">Tag</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-sm">
                      {event.id.substring(0, 8)}...
                    </td>
                    <td className="p-2 text-sm">
                      {new Date(event.received_at).toLocaleString()}
                    </td>
                    <td className="p-2 text-sm">
                      {isKajabiPayload(event.payload)
                        ? event.payload.contact?.email ?? 'N/A'
                        : 'N/A'}
                    </td>
                    <td className="p-2 text-sm">
                      {isKajabiPayload(event.payload)
                        ? event.payload.tag?.name ?? 'N/A'
                        : 'N/A'}
                    </td>
                    <td className="p-2">
                      {event.processed_at ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          Processed
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {!event.processed_at && (
                        <Button
                          variant="ghost"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleReprocess(event.id)}
                        >
                          Reprocess
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {events.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No Kajabi events received yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Card className="bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2">Webhook Configuration</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Webhook URL:</span>{' '}
              <code className="bg-white px-2 py-1 rounded">
                {typeof window !== 'undefined' ? window.location.origin : ''}
                /api/kajabi/webhook
              </code>
            </div>
            <div>
              <span className="font-medium">HTTP Method:</span> POST
            </div>
            <div>
              <span className="font-medium">Events to Subscribe:</span>{' '}
              course.completed, offer.purchased
            </div>
            <div>
              <span className="font-medium">Headers Required:</span>{' '}
              X-Kajabi-Signature
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default withRoleGuard(KajabiPage, ['admin', 'superadmin'])
