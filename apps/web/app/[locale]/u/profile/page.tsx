'use client'

import React, { useEffect, useState } from 'react'

import { useAuth } from '@clerk/nextjs'

import { Button, Card, Alert, Input, Label } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'

export default function ProfilePage() {
  const { isLoaded, userId } = useAuth()
  const [userType, setUserType] = useState<'EDUCATOR' | 'STUDENT' | null>(null)
  const [school, setSchool] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Array<{ name: string; city?: string | null; province?: string | null }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [lastQuery, setLastQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/profile/me')
        if (res.ok) {
          const json: unknown = await res.json()
          const data = (json && typeof json === 'object' && 'data' in json)
            ? (json as { data?: { userType?: 'EDUCATOR' | 'STUDENT'; school?: string | null; region?: string | null } }).data
            : undefined
          const ut = (data?.userType ?? null) as 'EDUCATOR' | 'STUDENT' | null
          setUserType(ut)
          setSchool(data?.school || '')
          setRegion(data?.region || '')
        }
      } catch { /* noop */ }
    }
    void load()
  }, [])

  // Debounced school suggestions
  useEffect(() => {
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
            const json: unknown = await res.json()
            const data = (json && typeof json === 'object' && 'data' in json)
              ? (json as { data?: Array<{ name: string; city?: string | null; province?: string | null }> }).data
              : []
            setSuggestions(Array.isArray(data) ? data : [])
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

  const onSave = async () => {
    if (!userType) return
    if (userType === 'EDUCATOR' && (!school.trim() || !region.trim())) {
      setError('Please provide School and Region')
      return
    }
    setSaving(true)
    setError(null)
    setInfo(null)
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
      setInfo('Profile saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-gray-600">Manage your role and school information.</p>

        {error && <Alert variant="destructive">{error}</Alert>}
        {info && <Alert>{info}</Alert>}

        <Card className="p-4 space-y-4">
          <div className="space-y-3">
            <Label>Role</Label>
            <label className="flex items-center gap-2">
              <input type="radio" name="ut" checked={userType === 'EDUCATOR'} onChange={() => setUserType('EDUCATOR')} />
              Educator
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="ut" checked={userType === 'STUDENT'} onChange={() => setUserType('STUDENT')} />
              Student
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

          <div>
            <Button onClick={onSave} disabled={!userType || (userType === 'EDUCATOR' && (!school.trim() || !region.trim())) || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  )
}
