'use client'

import React, { useState } from 'react'

import { useAuth } from '@clerk/nextjs'

import { Button, Card, Alert, Input, Label } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'

export default function UserTypeOnboardingPage() {
  const { isLoaded, userId } = useAuth()
  // Educator-focused onboarding: default selection to EDUCATOR
  const [userType, setUserType] = useState<'EDUCATOR' | 'STUDENT' | null>('EDUCATOR')
  const [school, setSchool] = useState('')
  const [region, setRegion] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; city?: string | null; province?: string | null }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    if (!userType) return
    if (userType === 'EDUCATOR' && (!school.trim() || !region.trim())) {
      setError('Please provide School and Region')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType, school: school.trim() || undefined, region: region.trim() || undefined }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to save')
      }
      window.location.href = '/dashboard'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  // Debounced school suggestions
  React.useEffect(() => {
    const q = school.trim()
    if (userType !== 'EDUCATOR') {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    if (!q || q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setLoadingSuggestions(true)
          setLastQuery(q)
          const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}&limit=10`)
          if (res.ok) {
            const json = (await res.json()) as { data?: Array<{ name: string; city?: string | null; province?: string | null }> }
            setSuggestions(json.data || [])
            setShowSuggestions(true)
          }
        } finally {
          setLoadingSuggestions(false)
        }
      })()
    }, 200)
    return () => clearTimeout(timer)
  }, [school, userType])

  if (!isLoaded) return <LoadingSpinner />
  if (!userId)
    return (
      <main style={{ padding: 24 }}>
        <Alert variant="destructive">Please sign in to continue.</Alert>
      </main>
    )

  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Confirm you are an Educator</h1>
        <p className="text-gray-600">Educators confirm School and Region to unlock LEAPS submissions and points. Students can still learn in our Kajabi portal.</p>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Card className="p-4 space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="radio" name="ut" checked={userType === 'EDUCATOR'} onChange={() => setUserType('EDUCATOR')} />
              Educator
            </label>
          </div>

          {userType === 'EDUCATOR' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="school">School</Label>
                <div className="relative">
                  <Input
                    id="school"
                    placeholder="Start typing to search…"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  />
                  {showSuggestions && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
                      {loadingSuggestions && (
                        <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                      )}
                      {!loadingSuggestions && suggestions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches for “{lastQuery}”</div>
                      )}
                      {suggestions.map((s) => (
                        <button
                          key={`${s.name}-${s.city || ''}-${s.province || ''}`}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSchool(s.name)
                            if (s.province && !region) setRegion(s.province)
                            setShowSuggestions(false)
                          }}
                        >
                          <div className="font-medium">{s.name}</div>
                          {(s.city || s.province) && (
                            <div className="text-xs text-gray-500">{[s.city, s.province].filter(Boolean).join(', ')}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="region">Region / Province</Label>
                <Input id="region" placeholder="e.g., DKI Jakarta" value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={onSave} disabled={!userType || (userType === 'EDUCATOR' && (!school.trim() || !region.trim())) || saving}>
              {saving ? 'Saving…' : 'Continue'}
            </Button>
            <LearnPortalLink />
          </div>
        </Card>
      </div>
    </main>
  )
}

function LearnPortalLink() {
  const portal = (typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_KAJABI_PORTAL_URL || ''))
  if (!portal) return null
  return (
    <a href={portal} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded border hover:bg-gray-50">
      Open Learn Portal
    </a>
  )
}
