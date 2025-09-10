'use client'

import React, { useMemo, useState, useEffect } from 'react'

import { useAuth } from '@clerk/nextjs'

import { Button, Card, Alert } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'

export default function AmplifyInvitePage() {
  const { isLoaded, userId } = useAuth()

  const [state, setState] = useState<{
    handle: string | null
    locale: string | null
    loading: boolean
    error: string | null
  }>({ handle: null, locale: null, loading: true, error: null })

  useEffect(() => {
    const run = async () => {
      if (!isLoaded) return
      if (!userId) {
        setState((s) => ({ ...s, loading: false, error: 'Please sign in' }))
        return
      }
      try {
        const locale = typeof window !== 'undefined' ? (window.location.pathname.split('/')[1] || 'en') : 'en'
        const linkRes = await fetch('/api/referrals/link')
        if (!linkRes.ok) throw new Error('Failed to get link')
        const linkJson = (await linkRes.json()) as { data?: { link?: string; refCode?: string } }
        const handle = linkJson?.data?.refCode || null
        setState({ handle, locale, loading: false, error: null })
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: 'Failed to prepare invite' }))
      }
    }
    void run()
  }, [isLoaded, userId])

  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const base = `${origin}/${state.locale || 'en'}`
    if (!state.handle) return base
    return `${base}?ref=${encodeURIComponent(state.handle)}`
  }, [state.handle, state.locale])

  if (!isLoaded || state.loading) {
    return (
      <main style={{ padding: 24 }}>
        <LoadingSpinner />
      </main>
    )
  }

  if (state.error) {
    return (
      <main style={{ padding: 24 }}>
        <Alert variant="destructive">{state.error}</Alert>
      </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Invite Peers & Students</h1>
        <p className="text-gray-600">Share your personal link below. When invitees sign up, you earn points automatically: +2 for an educator, +1 for a student.</p>

        <Card className="p-4">
          <div className="space-y-3">
            <div className="font-mono break-all bg-gray-50 p-3 rounded border">{shareUrl}</div>
            <div className="flex gap-2">
              <Button onClick={() => { navigator.clipboard.writeText(shareUrl).catch((err) => { console.warn('copy failed', err) }) }}>Copy Link</Button>
              <Button variant="secondary" onClick={() => { if (navigator.share) navigator.share({ url: shareUrl }).catch((err) => { console.warn('share failed', err) }) }}>Share…</Button>
            </div>
          </div>
        </Card>

        <div className="text-sm text-gray-500">Invitees will choose Educator or Student during onboarding.</div>
      </div>
    </main>
  )
}
