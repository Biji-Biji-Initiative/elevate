'use client'

import React, { useState } from 'react'

import { useAuth } from '@clerk/nextjs'

import { Button, Card, Alert } from '@elevate/ui'
import { LoadingSpinner } from '@elevate/ui/blocks'

export default function UserTypeOnboardingPage() {
  const { isLoaded, userId } = useAuth()
  const [userType, setUserType] = useState<'EDUCATOR' | 'STUDENT' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isLoaded) return <LoadingSpinner />
  if (!userId)
    return (
      <main style={{ padding: 24 }}>
        <Alert variant="destructive">Please sign in to continue.</Alert>
      </main>
    )

  const onSave = async () => {
    if (!userType) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/user-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType }),
      })
      if (!res.ok) throw new Error('Failed to save')
      window.location.href = '/dashboard'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Tell us who you are</h1>
        <p className="text-gray-600">Choose Educator or Student. Students cannot submit LEAPS evidence or appear on the leaderboard.</p>

        {error && <Alert variant="destructive">{error}</Alert>}

        <Card className="p-4">
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="radio" name="ut" onChange={() => setUserType('EDUCATOR')} />
              Educator
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="ut" onChange={() => setUserType('STUDENT')} />
              Student
            </label>
            <div>
              <Button onClick={onSave} disabled={!userType || saving}>
                {saving ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}

