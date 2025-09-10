'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'

import { getApiClient, type APIClient } from '@/lib/api-client'
import { createBadgeAction, updateBadgeAction, deleteBadgeAction, assignBadgeAction } from '@/lib/actions/badges'
import { toMsg } from '@/lib/errors'
import type { AdminBadge, AdminUser } from '@elevate/types/admin-api-types'
import {
  Button,
  Input,
  Textarea,
  Alert,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@elevate/ui'
import { DataTable, Modal, ConfirmModal, type Column } from '@elevate/ui/blocks'

type User = AdminUser
type Badge = {
  code: string
  name: string
  description: string
  icon_url: string | null
  criteria: {
    type: 'points' | 'submissions' | 'activities' | 'streak'
    threshold: number
    activity_codes: string[]
    conditions: Record<string, unknown>
  }
  _count?: { earned_badges: number }
}

export interface BadgesClientProps {
  initialBadges: Badge[]
  initialUsers: User[]
}

export default function BadgesClient({ initialBadges, initialUsers }: BadgesClientProps) {
  const [badges, setBadges] = useState<Badge[]>(initialBadges)
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const setErrorString = (msg: string) => setError(msg)

  // Modal states
  const [badgeModal, setBadgeModal] = useState<{
    isOpen: boolean
    badge?: Badge
    mode: 'create' | 'edit'
  }>({ isOpen: false, mode: 'create' })

  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean
    badge?: BadgeRow
  }>({ isOpen: false })

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    badge?: BadgeRow
  }>({ isOpen: false })

  type BadgeForm = {
    code: string
    name: string
    description: string
    criteria: {
      type: 'points' | 'submissions' | 'activities' | 'streak'
      threshold: number
      activity_codes: string[]
      conditions: Record<string, unknown>
    }
    icon_url?: string
  }

  const [badgeForm, setBadgeForm] = useState<BadgeForm>({
    code: '',
    name: '',
    description: '',
    criteria: {
      type: 'points',
      threshold: 0,
      activity_codes: [],
      conditions: {},
    },
    icon_url: '',
  })

  type AssignForm = { userIds: string[]; reason: string }
  const [assignForm, setAssignForm] = useState<AssignForm>({ userIds: [], reason: '' })

  const [processing, setProcessing] = useState(false)

  const columns: ReadonlyArray<Column<BadgeRow>> = [
    {
      key: 'name',
      header: 'Badge',
      accessor: (row) => ({ name: row.name, code: row.code, icon_url: row.icon_url ?? '' }),
      sortAccessor: (row) => row.name,
      render: (row: BadgeRow) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            {row.icon_url ? (
              <Image src={row.icon_url} alt={row.name} width={32} height={32} className="w-8 h-8 rounded-full" />
            ) : (
              <span className="text-white font-bold">🏆</span>
            )}
          </div>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-sm text-gray-500">{row.code}</div>
          </div>
        </div>
      ),
      width: '250px',
    },
    {
      key: 'description',
      header: 'Description',
      accessor: (row) => row.description,
      render: (row: BadgeRow) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-600 truncate">{row.description}</p>
        </div>
      ),
      width: '300px',
    },
    {
      key: 'criteria.type',
      header: 'Type',
      accessor: (row) => row.criteria_type,
      render: (row: BadgeRow) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm capitalize">
          {row.criteria_type}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'criteria.threshold',
      header: 'Threshold',
      accessor: (row) => ({ threshold: row.criteria_threshold, type: row.criteria_type }),
      sortAccessor: (row) => row.criteria_threshold,
      render: (row: BadgeRow) => (
        <div className="text-sm">
          {row.criteria_threshold}
          {row.criteria_type === 'points' && ' pts'}
          {row.criteria_type === 'submissions' && ' subs'}
          {row.criteria_type === 'streak' && ' days'}
        </div>
      ),
      width: '100px',
    },
    {
      key: '_count.earned_badges',
      header: 'Earned',
      accessor: (row) => row.earned_badges,
      render: (row: BadgeRow) => <div className="text-center font-medium">{row.earned_badges}</div>,
      width: '80px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: BadgeRow) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation()
              openEditModal(row)
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation()
              setAssignModal({ isOpen: true, badge: row })
              setAssignForm({ userIds: [], reason: '' })
            }}
          >
            Assign
          </Button>
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}
            onClick={(e) => {
              e.stopPropagation()
              setDeleteModal({ isOpen: true, badge: row })
            }}
          >
            Delete
          </Button>
        </div>
      ),
      width: '200px',
      sortable: false,
    },
  ]

  const fetchBadges = React.useCallback(async () => {
    setLoading(true)
    try {
      const api: APIClient = getApiClient()
      const res = await api.getAdminBadges({ includeStats: 'true' })
      const srvBadges: AdminBadge[] = res.data.badges as unknown as AdminBadge[]
      const list: Badge[] = srvBadges.map((b: AdminBadge): Badge => ({
        code: b.code,
        name: b.name,
        description: b.description,
        icon_url: b.icon_url ?? null,
        criteria: {
          type: b.criteria.type,
          threshold: b.criteria.threshold,
          activity_codes: b.criteria.activity_codes ?? [],
          conditions: b.criteria.conditions ?? {},
        },
        _count: { earned_badges: b._count?.earned_badges ?? 0 },
      }))
      setBadges(list)
    } catch (error: unknown) {
      const msg = toMsg('Badge fetch', error)
      setErrorString(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUsers = React.useCallback(async () => {
    try {
      const api: APIClient = getApiClient()
      const res = await api.getAdminUsers({ limit: 1000 })
      setUsers(Array.isArray(res.data.users) ? (res.data.users as AdminUser[]) : [])
    } catch (error: unknown) {
      const msg = toMsg('User fetch', error)
      setErrorString(msg)
    }
  }, [])

  useEffect(() => {
    // Keep server-provided values as defaults and refresh in background
    void fetchBadges()
    if (initialUsers.length === 0) void fetchUsers()
  }, [fetchBadges, fetchUsers, initialUsers.length])

  const openCreateModal = () => {
    setBadgeModal({ isOpen: true, mode: 'create' })
    setBadgeForm({
      code: '',
      name: '',
      description: '',
      criteria: { type: 'points', threshold: 0, activity_codes: [], conditions: {} },
      icon_url: '',
    })
  }

  const openEditModal = (row: BadgeRow) => {
    const badge: Badge | undefined = badges.find((b: Badge) => b.code === row.code)
    if (!badge) return
    setBadgeModal({ isOpen: true, badge, mode: 'edit' })
    setBadgeForm({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      criteria: {
        type: badge.criteria.type,
        threshold: badge.criteria.threshold,
        activity_codes: badge.criteria.activity_codes || [],
        conditions: badge.criteria.conditions || {},
      },
      icon_url: badge.icon_url || '',
    })
  }

  const closeBadgeModal = () => {
    setBadgeModal({ isOpen: false, mode: 'create' })
    setBadgeForm({
      code: '',
      name: '',
      description: '',
      criteria: { type: 'points', threshold: 0, activity_codes: [], conditions: {} },
      icon_url: '',
    })
  }

  const handleCreateBadge = async () => {
    setProcessing(true)
    try {
      await createBadgeAction({
        code: badgeForm.code,
        name: badgeForm.name,
        description: badgeForm.description,
        criteria: badgeForm.criteria,
        ...(badgeForm.icon_url ? { icon_url: badgeForm.icon_url } : {}),
      })
      await fetchBadges()
      closeBadgeModal()
    } catch (error: unknown) {
      const msg = toMsg('Create badge', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateBadge = async () => {
    setProcessing(true)
    try {
      await updateBadgeAction({
        code: badgeForm.code,
        name: badgeForm.name || undefined,
        description: badgeForm.description || undefined,
        criteria: badgeForm.criteria,
        icon_url: badgeForm.icon_url || undefined,
      })
      await fetchBadges()
      closeBadgeModal()
    } catch (error: unknown) {
      const msg = toMsg('Update badge', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteBadge = async () => {
    if (!deleteModal.badge) return
    setProcessing(true)
    try {
      await deleteBadgeAction(deleteModal.badge.code)
      await fetchBadges()
      setDeleteModal({ isOpen: false })
    } catch (error: unknown) {
      const msg = toMsg('Delete badge', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignBadge = async () => {
    if (!assignModal.badge || assignForm.userIds.length === 0) return
    setProcessing(true)
    try {
      await assignBadgeAction({ badgeCode: assignModal.badge.code, userIds: assignForm.userIds, reason: assignForm.reason || undefined })
      setAssignModal({ isOpen: false })
      setAssignForm({ userIds: [], reason: '' })
    } catch (error: unknown) {
      const msg = toMsg('Assign badge', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  // Prepare display rows with a flat, UI-safe shape
  type BadgeRow = {
    code: string
    name: string
    description: string
    icon_url: string
    criteria_type: 'points' | 'submissions' | 'activities' | 'streak'
    criteria_threshold: number
    earned_badges: number
  }

  const rows: BadgeRow[] = badges.map((b: Badge): BadgeRow => ({
    code: b.code,
    name: b.name,
    description: b.description,
    icon_url: b.icon_url ?? '',
    criteria_type: b.criteria.type,
    criteria_threshold: b.criteria.threshold,
    earned_badges: b._count?.earned_badges ?? 0,
  }))

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Badge Management</h1>
          <p className="text-gray-600">Create and manage achievement badges for participants</p>
        </div>
        <Button variant="default" onClick={openCreateModal}>Create Badge</Button>
      </div>

      {/* Data Table */}
      <DataTable<BadgeRow>
        data={rows}
        columns={columns}
        loading={loading}
        selection={{
          selectedRows,
          onSelectionChange: (rows: Set<string | number>) => setSelectedRows(new Set(Array.from(rows).map(String))),
          getRowId: (row) => row.code,
        }}
        emptyMessage="No badges found. Create your first badge to get started."
      />

      {/* Create/Edit Badge Modal */}
      <Modal
        isOpen={badgeModal.isOpen}
        onClose={closeBadgeModal}
        title={badgeModal.mode === 'create' ? 'Create New Badge' : 'Edit Badge'}
        size="md"
        actions={
          <div className="space-x-3">
            <Button variant="ghost" onClick={closeBadgeModal} disabled={processing}>
              Cancel
            </Button>
            {badgeModal.mode === 'create' ? (
              <Button variant="default" onClick={handleCreateBadge} disabled={processing}>
                {processing ? 'Creating...' : 'Create Badge'}
              </Button>
            ) : (
              <Button variant="default" onClick={handleUpdateBadge} disabled={processing}>
                {processing ? 'Updating...' : 'Update Badge'}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="badge-code" className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <Input
              id="badge-code"
              value={badgeForm.code}
              onChange={(e) => setBadgeForm((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="unique_badge_code"
              disabled={badgeModal.mode === 'edit'}
            />
          </div>

          <div>
            <label htmlFor="badge-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input id="badge-name" value={badgeForm.name} onChange={(e) => setBadgeForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Badge Name" />
          </div>

          <div>
            <label htmlFor="badge-description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea id="badge-description" value={badgeForm.description} onChange={(e) => setBadgeForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="What achievements does this badge represent?" rows={3} />
          </div>

          <div>
            <label htmlFor="badge-icon-url" className="block text-sm font-medium text-gray-700 mb-1">
              Icon URL (Optional)
            </label>
            <Input id="badge-icon-url" value={badgeForm.icon_url} onChange={(e) => setBadgeForm((prev) => ({ ...prev, icon_url: e.target.value }))} placeholder="https://..." />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Badge Criteria</h3>

            <div>
              <label htmlFor="badge-criteria-type" className="block text-sm font-medium text-gray-700 mb-1">
                Criteria Type
              </label>
              <Select
                value={badgeForm.criteria.type}
                onValueChange={(value) =>
                  setBadgeForm((prev) => ({ ...prev, criteria: { ...prev.criteria, type: value as Badge['criteria']['type'] } }))
                }
              >
                <SelectTrigger id="badge-criteria-type">
                  <SelectValue placeholder="Select criteria type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points Threshold</SelectItem>
                  <SelectItem value="submissions">Submission Count</SelectItem>
                  <SelectItem value="activities">Activity Completion</SelectItem>
                  <SelectItem value="streak">Daily Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3">
              <label htmlFor="badge-threshold" className="block text-sm font-medium text-gray-700 mb-1">
                Threshold
              </label>
              <Input
                id="badge-threshold"
                type="number"
                value={badgeForm.criteria.threshold}
                onChange={(e) => setBadgeForm((prev) => ({ ...prev, criteria: { ...prev.criteria, threshold: Number(e.target.value) } }))}
                placeholder="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                {badgeForm.criteria.type === 'points' && 'Minimum points required'}
                {badgeForm.criteria.type === 'submissions' && 'Number of approved submissions'}
                {badgeForm.criteria.type === 'activities' && 'Number of different activities completed'}
                {badgeForm.criteria.type === 'streak' && 'Consecutive days of activity'}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Assign Badge Modal */}
      <Modal
        isOpen={assignModal.isOpen}
        onClose={() => setAssignModal({ isOpen: false })}
        title={`Assign Badge: ${assignModal.badge?.name}`}
        size="md"
        actions={
          <div className="space-x-3">
            <Button variant="ghost" onClick={() => setAssignModal({ isOpen: false })} disabled={processing}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleAssignBadge} disabled={processing || assignForm.userIds.length === 0}>
              {processing ? 'Assigning...' : `Assign to ${assignForm.userIds.length} users`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="assign-users" className="block text-sm font-medium text-gray-700 mb-1">
              Select Users
            </label>
            <select
              id="assign-users"
              multiple
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ height: '120px' }}
              value={assignForm.userIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((option) => option.value)
                setAssignForm((prev) => ({ ...prev, userIds: selected }))
              }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} (@{user.handle})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple users</p>
          </div>

          <div>
            <label htmlFor="assign-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason (Optional)
            </label>
            <Textarea
              id="assign-reason"
              value={assignForm.reason}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Manual assignment for special achievement..."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Badge Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={handleDeleteBadge}
        title="Delete Badge"
        message={`Are you sure you want to delete "${deleteModal.badge?.name}"? This badge has been earned ${deleteModal.badge?.earned_badges || 0} times.`}
        confirmText="Delete Badge"
        isLoading={processing}
      />
    </div>
  )
}
