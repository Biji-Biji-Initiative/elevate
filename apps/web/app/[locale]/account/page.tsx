'use client'
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */

import React from 'react'

import { UserProfile } from '@clerk/nextjs'

import { useCurrentLocale } from '@elevate/ui/next'
import { LearnPortalLink } from '@/components/LearnPortalLink'
import { buildQueryString } from '@/lib/utils/query'
import { safeJsonParse } from '@/lib/utils/safe-json'

export default function AccountPage() {
  const { withLocale } = useCurrentLocale()
  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Account Settings</h1>
        <p className="text-gray-600 mb-6">
          Manage your sign-in methods, profile image, and account security. Your LEAPS role and school information remain editable on your Profile page.
        </p>
        <UserProfile
          routing="path"
          path="/account"
          appearance={{
            variables: {
              colorPrimary: '#2563EB', // Tailwind blue-600
              colorText: '#111827',
              colorBackground: 'white',
              colorInputBackground: 'white',
              borderRadius: '0.5rem',
            },
            elements: {
              rootBox: 'shadow-none p-0',
              card: 'border rounded-lg',
              headerTitle: 'text-xl',
              headerSubtitle: 'text-sm text-gray-500',
            },
          }}
        >
          <UserProfile.Link label="LEAPS Dashboard" url={withLocale('/dashboard')} labelIcon={<span />} />
          <UserProfile.Link
            label="Invite Peers/Students"
            url={withLocale('/dashboard/amplify/invite')}
            labelIcon={<span />}
          />
          <UserProfile.Page label="LEAPS Profile" url="leaps-profile" labelIcon={<span />}>
            <LeapsProfileForm />
          </UserProfile.Page>
        </UserProfile>
      </div>
    </main>
  )
}

function LeapsProfileForm() {
  const [userType, setUserType] = React.useState<'EDUCATOR' | 'STUDENT' | null>(null)
  const [school, setSchool] = React.useState('')
  const [region, setRegion] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)
  const [suggestions, setSuggestions] = React.useState<Array<{ name: string; city?: string | null; province?: string | null }>>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(false)
  const [lastQuery, setLastQuery] = React.useState('')

  React.useEffect(() => {
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
      } catch {
        // ignore
      }
    }
    void load()
  }, [])

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
          const res = await fetch(`/api/schools?${buildQueryString({ q, limit: 10 })}`)
          if (res.ok) {
            const text = await res.text()
            const parsed = safeJsonParse<{ data?: Array<{ name: string; city?: string | null; province?: string | null }> }>(text)
            const data = (parsed && typeof parsed === 'object' && 'data' in parsed)
              ? (parsed as { data?: Array<{ name: string; city?: string | null; province?: string | null }> }).data
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
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">LEAPS Profile</h2>
      <p className="text-sm text-gray-600 mb-4">If you are an Educator, set your School and Region to unlock LEAPS submissions and points. Students can still learn in our Kajabi portal.</p>
      {error && <div className="rounded border border-red-200 bg-red-50 text-red-800 text-sm p-2 mb-3">{error}</div>}
      {info && <div className="rounded border border-green-200 bg-green-50 text-green-800 text-sm p-2 mb-3">{info}</div>}
      <div className="space-y-3 mb-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="ut" checked={userType === 'EDUCATOR'} onChange={() => setUserType('EDUCATOR')} />
          Educator
        </label>
      </div>
      {userType === 'EDUCATOR' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="school">School</label>
            <div className="relative">
              <input
                id="school"
                className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium mb-1" htmlFor="region">Region / Province</label>
            <input id="region" className="w-full border rounded px-3 py-2" placeholder="e.g., DKI Jakarta" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!userType || (userType === 'EDUCATOR' && (!school.trim() || !region.trim())) || saving}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <LearnPortalLink />
      </div>
    </div>
  )
}

// Shared LearnPortalLink component is used above
