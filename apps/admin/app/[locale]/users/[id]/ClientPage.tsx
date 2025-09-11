'use client'

import React from 'react'

import { updateLeapsUserAction } from '@/lib/actions/users'
import { Button, Input, Alert } from '@elevate/ui'

type Props = {
  user: {
    id: string
    email: string
    name?: string | null
    handle?: string | null
    user_type: 'EDUCATOR' | 'STUDENT'
    user_type_confirmed: boolean
    school?: string | null
    region?: string | null
  }
}

export default function AdminUserLeapsClient({ user }: Props) {
  const [userType, setUserType] = React.useState<'EDUCATOR' | 'STUDENT'>(user.user_type)
  const [confirmed, setConfirmed] = React.useState<boolean>(!!user.user_type_confirmed)
  const [school, setSchool] = React.useState<string>(user.school || '')
  const [region, setRegion] = React.useState<string>(user.region || '')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  const onSave = async () => {
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      const payload: { userId: string; userType?: 'EDUCATOR' | 'STUDENT'; userTypeConfirmed?: boolean; school?: string; region?: string } = { userId: user.id }
      if (userType) payload.userType = userType
      if (typeof confirmed === 'boolean') payload.userTypeConfirmed = confirmed
      if (school) payload.school = school
      if (region) payload.region = region
      await updateLeapsUserAction(payload)
      setInfo('Saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {info && <Alert>{info}</Alert>}
      <div>
        <div className="text-sm text-gray-500">User</div>
        <div className="text-base font-medium">{user.name || user.email}</div>
        <div className="text-xs text-gray-500">@{user.handle || '—'} • {user.email}</div>
      </div>

      <div className="space-y-2">
        <div className="font-medium">Role (LEAPS)</div>
        <label className="flex items-center gap-2">
          <input type="radio" name="ut" checked={userType === 'EDUCATOR'} onChange={() => setUserType('EDUCATOR')} />
          Educator
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="ut" checked={userType === 'STUDENT'} onChange={() => setUserType('STUDENT')} />
          Student
        </label>
        <label className="flex items-center gap-2 mt-2">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Role confirmed (onboarding complete)
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="school">School</label>
          <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="School name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="region">Region / Province</label>
          <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., DKI Jakarta" />
        </div>
      </div>

      <div>
        <Button onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  )
}
