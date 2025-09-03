'use client'

import React, { useState, useEffect } from 'react'

import { withRoleGuard } from '@elevate/auth/context'
import { adminClient, type UsersQuery } from '@/lib/admin-client'
import { Button , Input, DataTable, StatusBadge, Modal, ConfirmModal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, createColumns, Alert } from '@elevate/ui'
import type { Column } from '@elevate/ui'

type User = {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly email: string
  readonly avatar_url?: string | null | undefined
  readonly role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  readonly school?: string | null | undefined
  readonly cohort?: string | null | undefined
  readonly created_at: string
  readonly totalPoints: number
  readonly _count: {
    submissions: number
    ledger: number
    earned_badges: number
  }
}

interface Filters {
  search: string
  role: string
  cohort: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [cohorts, setCohorts] = useState<string[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })
  
  const [filters, setFilters] = useState<Filters>({
    search: '',
    role: 'ALL',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  // Modal states
  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    user?: User
  }>({
    isOpen: false
  })

  const [bulkRoleModal, setBulkRoleModal] = useState<{
    isOpen: boolean
    targetRole: string
  }>({
    isOpen: false,
    targetRole: 'PARTICIPANT'
  })

  const [editForm, setEditForm] = useState({
    name: '',
    handle: '',
    school: '',
    cohort: '',
    role: 'PARTICIPANT'
  })

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const columns = createColumns<User>()([
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm">
            {row.name[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-sm text-gray-500">@{row.handle}</div>
            <div className="text-xs text-gray-400">{row.email}</div>
          </div>
        </div>
      ),
      width: '250px'
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <StatusBadge status={row.role} />,
      width: '120px'
    },
    {
      key: 'school',
      header: 'School',
      render: (row) => row.school || '-',
      width: '150px'
    },
    {
      key: 'cohort',
      header: 'Cohort',
      render: (row) => row.cohort || '-',
      width: '100px'
    },
    {
      key: 'totalPoints',
      header: 'Points',
      render: (row) => (
        <div className="text-right">
          <div className="font-medium">{row.totalPoints}</div>
        </div>
      ),
      width: '80px'
    },
    {
      key: '_count.submissions',
      header: 'Submissions',
      render: (row) => (
        <div className="text-center">
          {row._count.submissions}
        </div>
      ),
      width: '100px'
    },
    {
      key: '_count.earned_badges',
      header: 'Badges',
      render: (row) => (
        <div className="text-center">
          {row._count.earned_badges}
        </div>
      ),
      width: '80px'
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
      width: '100px'
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
        </div>
      ),
      width: '80px',
      sortable: false
    }
  ])

  useEffect(() => {
    void fetchUsers()
  }, [pagination.page, pagination.limit, filters])

  useEffect(() => {
    const fetchCohorts = async () => {
      try {
        setCohorts(await adminClient.getCohorts())
      } catch (error) {
        // Cohorts are optional for UI, don't break on fetch failure
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch cohorts:', error);
        }
      }
    }
    void fetchCohorts()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })

      if (filters.role !== 'ALL') params.set('role', filters.role)
      if (filters.search) params.set('search', filters.search)
      if (filters.cohort !== 'ALL') params.set('cohort', filters.cohort)

      const { users, pagination: pageInfo } = await adminClient.getUsers(Object.fromEntries(params) as UsersQuery)
      setUsers(users)
      setPagination(prev => ({ ...prev, total: pageInfo.total, pages: pageInfo.pages }))
    } catch (error) {
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({ ...prev, sortBy, sortOrder }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const openEditModal = (user: User) => {
    setEditModal({ isOpen: true, user })
    setEditForm({
      name: user.name,
      handle: user.handle,
      school: user.school || '',
      cohort: user.cohort || '',
      role: user.role
    })
  }

  const closeEditModal = () => {
    setEditModal({ isOpen: false })
    setEditForm({
      name: '',
      handle: '',
      school: '',
      cohort: '',
      role: 'PARTICIPANT'
    })
  }

  const handleEditUser = async () => {
    if (!editModal.user) return

    setProcessing(true)
    try {
      const updateData: Parameters<typeof adminClient.updateUser>[0] = {
        userId: editModal.user.id,
      }
      if (editForm.name) updateData.name = editForm.name
      if (editForm.handle) updateData.handle = editForm.handle
      if (editForm.school) updateData.school = editForm.school
      if (editForm.cohort) updateData.cohort = editForm.cohort
      if (editForm.role) updateData.role = editForm.role as 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
      
      await adminClient.updateUser(updateData)
      await fetchUsers()
      closeEditModal()
    } catch (error) {
      setError('Failed to update user')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkRoleUpdate = async () => {
    if (selectedRows.size === 0) return

    setProcessing(true)
    try {
      await adminClient.bulkUpdateUsers({ userIds: Array.from(selectedRows), role: bulkRoleModal.targetRole as 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN' })
      setSelectedRows(new Set())
      await fetchUsers()
      setBulkRoleModal({ isOpen: false, targetRole: 'PARTICIPANT' })
    } catch (error) {
      setError('Failed to update user roles')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage user roles, profiles, and permissions</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label htmlFor="users-filter-search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              id="users-filter-search"
              placeholder="Search by name, email, handle..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div>
            <label id="users-filter-role-label" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select value={filters.role} onValueChange={(value) => setFilters(prev => ({ ...prev, role: value }))}>
              <SelectTrigger aria-labelledby="users-filter-role-label">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="PARTICIPANT">Participant</SelectItem>
                <SelectItem value="REVIEWER">Reviewer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label id="users-filter-cohort-label" className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <Select value={filters.cohort} onValueChange={(value) => setFilters(prev => ({ ...prev, cohort: value }))}>
              <SelectTrigger aria-labelledby="users-filter-cohort-label">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cohorts</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={fetchUsers} style={{ width: '100%' }}>
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRows.size > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRows.size} users selected
              </span>
              <div className="space-x-2">
                <Select value={bulkRoleModal.targetRole} onValueChange={(value) => setBulkRoleModal(prev => ({ ...prev, targetRole: value }))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARTICIPANT">Participant</SelectItem>
                    <SelectItem value="REVIEWER">Reviewer</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  onClick={() => setBulkRoleModal(prev => ({ ...prev, isOpen: true }))}
                >
                  Update Roles
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}

      <DataTable<User>
        data={users}
        columns={columns}
        loading={loading}
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          onPageChange: handlePageChange
        }}
        selection={{
          selectedRows,
          onSelectionChange: (selectedRows: Set<string | number>) => setSelectedRows(new Set(Array.from(selectedRows).map(String))),
          getRowId: (row) => row.id
        }}
        sorting={{
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          onSort: handleSort
        }}
        emptyMessage="No users found matching your criteria"
      />

      {/* Edit User Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        title="Edit User"
        size="md"
        actions={
          <div className="space-x-3">
            <Button variant="ghost" onClick={closeEditModal} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleEditUser}
              disabled={processing}
            >
              {processing ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              id="edit-user-name"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>

          <div>
            <label htmlFor="edit-user-handle" className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
            <Input
              id="edit-user-handle"
              value={editForm.handle}
              onChange={(e) => setEditForm(prev => ({ ...prev, handle: e.target.value }))}
              placeholder="@username"
            />
          </div>

          <div>
            <label htmlFor="edit-user-school" className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <Input
              id="edit-user-school"
              value={editForm.school}
              onChange={(e) => setEditForm(prev => ({ ...prev, school: e.target.value }))}
              placeholder="School name"
            />
          </div>

          <div>
            <label id="edit-user-cohort-label" className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <Select value={editForm.cohort} onValueChange={(value) => setEditForm(prev => ({ ...prev, cohort: value }))}>
              <SelectTrigger aria-labelledby="edit-user-cohort-label">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Cohort</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label id="edit-user-role-label" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value }))}>
              <SelectTrigger aria-labelledby="edit-user-role-label">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PARTICIPANT">Participant</SelectItem>
                <SelectItem value="REVIEWER">Reviewer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPERADMIN">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Modal>

      {/* Bulk Role Update Modal */}
      <ConfirmModal
        isOpen={bulkRoleModal.isOpen}
        onClose={() => setBulkRoleModal({ isOpen: false, targetRole: 'PARTICIPANT' })}
        onConfirm={handleBulkRoleUpdate}
        title="Update User Roles"
        message={`Are you sure you want to update ${selectedRows.size} users to ${bulkRoleModal.targetRole} role?`}
        confirmText="Update Roles"
        isLoading={processing}
      />
    </div>
  )
}

export default withRoleGuard(UsersPage, ['admin', 'superadmin'])
