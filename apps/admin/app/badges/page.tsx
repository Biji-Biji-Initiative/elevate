'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@elevate/ui'
import { Input } from '@elevate/ui/Input'
import { Textarea } from '@elevate/ui/Textarea'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Modal, ConfirmModal } from '../../components/ui/Modal'

interface Badge {
  code: string
  name: string
  description: string
  criteria: {
    type: 'points' | 'submissions' | 'activities' | 'streak'
    threshold: number
    activity_codes?: string[]
    conditions?: Record<string, any>
  }
  icon_url?: string
  earned_badges?: Array<{
    id: string
    user: {
      id: string
      name: string
      handle: string
    }
    earned_at: string
  }>
  _count?: {
    earned_badges: number
  }
}

interface User {
  id: string
  name: string
  handle: string
  email: string
}

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  
  // Modal states
  const [badgeModal, setBadgeModal] = useState<{
    isOpen: boolean
    badge?: Badge
    mode: 'create' | 'edit'
  }>({
    isOpen: false,
    mode: 'create'
  })

  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean
    badge?: Badge
  }>({
    isOpen: false
  })

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    badge?: Badge
  }>({
    isOpen: false
  })

  const [badgeForm, setBadgeForm] = useState({
    code: '',
    name: '',
    description: '',
    criteria: {
      type: 'points' as 'points' | 'submissions' | 'activities' | 'streak',
      threshold: 0,
      activity_codes: [] as string[],
      conditions: {}
    },
    icon_url: ''
  })

  const [assignForm, setAssignForm] = useState({
    userIds: [] as string[],
    reason: ''
  })

  const [processing, setProcessing] = useState(false)

  const columns: Column<Badge>[] = [
    {
      key: 'name',
      header: 'Badge',
      render: (row) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            {row.icon_url ? (
              <img src={row.icon_url} alt={row.name} className="w-8 h-8 rounded-full" />
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
      width: '250px'
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-600 truncate">{row.description}</p>
        </div>
      ),
      width: '300px'
    },
    {
      key: 'criteria.type',
      header: 'Type',
      render: (row) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm capitalize">
          {row.criteria.type}
        </span>
      ),
      width: '100px'
    },
    {
      key: 'criteria.threshold',
      header: 'Threshold',
      render: (row) => (
        <div className="text-sm">
          {row.criteria.threshold}
          {row.criteria.type === 'points' && ' pts'}
          {row.criteria.type === 'submissions' && ' subs'}
          {row.criteria.type === 'streak' && ' days'}
        </div>
      ),
      width: '100px'
    },
    {
      key: '_count.earned_badges',
      header: 'Earned',
      render: (row) => (
        <div className="text-center font-medium">
          {row._count?.earned_badges || 0}
        </div>
      ),
      width: '80px'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
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
            style={{ 
              padding: '4px 8px', 
              fontSize: '12px',
              color: '#dc2626'
            }}
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
      sortable: false
    }
  ]

  useEffect(() => {
    fetchBadges()
    fetchUsers()
  }, [])

  const fetchBadges = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/badges?includeStats=true')
      const data = await response.json()
      
      if (response.ok) {
        setBadges(data.badges)
      } else {
        console.error('Failed to fetch badges:', data.error)
      }
    } catch (error) {
      console.error('Error fetching badges:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users?limit=1000')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const openCreateModal = () => {
    setBadgeModal({ isOpen: true, mode: 'create' })
    setBadgeForm({
      code: '',
      name: '',
      description: '',
      criteria: {
        type: 'points',
        threshold: 0,
        activity_codes: [],
        conditions: {}
      },
      icon_url: ''
    })
  }

  const openEditModal = (badge: Badge) => {
    setBadgeModal({ isOpen: true, badge, mode: 'edit' })
    setBadgeForm({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      criteria: {
        ...badge.criteria,
        activity_codes: badge.criteria.activity_codes || [],
        conditions: badge.criteria.conditions || {}
      },
      icon_url: badge.icon_url || ''
    })
  }

  const closeBadgeModal = () => {
    setBadgeModal({ isOpen: false, mode: 'create' })
    setBadgeForm({
      code: '',
      name: '',
      description: '',
      criteria: {
        type: 'points',
        threshold: 0,
        activity_codes: [],
        conditions: {}
      },
      icon_url: ''
    })
  }

  const handleCreateBadge = async () => {
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badgeForm)
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchBadges()
        closeBadgeModal()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error creating badge:', error)
      alert('Failed to create badge')
    } finally {
      setProcessing(false)
    }
  }

  const handleEditBadge = async () => {
    if (!badgeModal.badge) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/badges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...badgeForm,
          code: badgeModal.badge.code
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchBadges()
        closeBadgeModal()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating badge:', error)
      alert('Failed to update badge')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteBadge = async () => {
    if (!deleteModal.badge) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/admin/badges?code=${deleteModal.badge.code}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchBadges()
        setDeleteModal({ isOpen: false })
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting badge:', error)
      alert('Failed to delete badge')
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignBadge = async () => {
    if (!assignModal.badge || assignForm.userIds.length === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/badges/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badgeCode: assignModal.badge.code,
          userIds: assignForm.userIds,
          reason: assignForm.reason
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchBadges()
        setAssignModal({ isOpen: false })
        setAssignForm({ userIds: [], reason: '' })
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error assigning badge:', error)
      alert('Failed to assign badge')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Badge Management</h1>
          <p className="text-gray-600">Create and manage achievement badges for participants</p>
        </div>
        <Button
          variant="default"
          onClick={openCreateModal}
        >
          Create Badge
        </Button>
      </div>

      {/* Data Table */}
      <DataTable
        data={badges}
        columns={columns}
        loading={loading}
        selection={{
          selectedRows,
          onSelectionChange: (selectedRows: Set<string | number>) => setSelectedRows(new Set(Array.from(selectedRows).map(String))),
          getRowId: (row) => row.code
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
            <Button
              variant="default"
              onClick={badgeModal.mode === 'create' ? handleCreateBadge : handleEditBadge}
              disabled={processing}
            >
              {processing ? 'Saving...' : badgeModal.mode === 'create' ? 'Create Badge' : 'Update Badge'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <Input
              value={badgeForm.code}
              onChange={(e) => setBadgeForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="BADGE_CODE"
              disabled={badgeModal.mode === 'edit'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={badgeForm.name}
              onChange={(e) => setBadgeForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Badge Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Textarea
              value={badgeForm.description}
              onChange={(e) => setBadgeForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this badge represents..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon URL (Optional)</label>
            <Input
              value={badgeForm.icon_url}
              onChange={(e) => setBadgeForm(prev => ({ ...prev, icon_url: e.target.value }))}
              placeholder="https://example.com/badge-icon.png"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Badge Criteria</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={badgeForm.criteria.type}
                onChange={(e) => setBadgeForm(prev => ({ 
                  ...prev, 
                  criteria: { ...prev.criteria, type: e.target.value as any } 
                }))}
              >
                <option value="points">Points Threshold</option>
                <option value="submissions">Submission Count</option>
                <option value="activities">Activity Completion</option>
                <option value="streak">Daily Streak</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
              <Input
                type="number"
                value={badgeForm.criteria.threshold}
                onChange={(e) => setBadgeForm(prev => ({ 
                  ...prev, 
                  criteria: { ...prev.criteria, threshold: Number(e.target.value) } 
                }))}
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
            <Button 
              variant="ghost" 
              onClick={() => setAssignModal({ isOpen: false })} 
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAssignBadge}
              disabled={processing || assignForm.userIds.length === 0}
            >
              {processing ? 'Assigning...' : `Assign to ${assignForm.userIds.length} users`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Users</label>
            <select
              multiple
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ height: '120px' }}
              value={assignForm.userIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(option => option.value)
                setAssignForm(prev => ({ ...prev, userIds: selected }))
              }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} (@{user.handle})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Hold Ctrl/Cmd to select multiple users
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
            <Textarea
              value={assignForm.reason}
              onChange={(e) => setAssignForm(prev => ({ ...prev, reason: e.target.value }))}
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
        message={`Are you sure you want to delete "${deleteModal.badge?.name}"? This badge has been earned ${deleteModal.badge?._count?.earned_badges || 0} times.`}
        confirmText="Delete Badge"
        isLoading={processing}
      />
    </div>
  )
}