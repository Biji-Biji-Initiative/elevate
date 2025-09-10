'use client'

import React, { useState, useCallback } from 'react'

import { toMsg } from '@/lib/errors'
import { toUserUI, type UserUI } from '@/lib/ui-types'
import { getApiClient, type APIClient } from '@/lib/api-client'
import { updateUserAction, bulkUpdateUsersAction } from '@/lib/actions/users'
import type { UserRole } from '@elevate/types'
import type { UsersQuery, AdminUser } from '@elevate/types/admin-api-types'
import {
  Button,
  Input,
  Alert,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@elevate/ui'
import { DataTable, StatusBadge, Modal, ConfirmModal, type Column } from '@elevate/ui/blocks'

type User = UserUI

interface Filters {
  search: string
  role: UserRole | 'ALL'
  cohort: string
  sortBy: 'created_at' | 'name' | 'email'
  sortOrder: 'asc' | 'desc'
}

export interface UsersClientProps {
  initialUsers: UserUI[]
  initialCohorts: string[]
  initialPagination: { page: number; limit: number; total: number; pages: number }
}

export default function UsersClient({ initialUsers, initialCohorts, initialPagination }: UsersClientProps) {
  const [users, setUsers] = useState<UserUI[]>(initialUsers)
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [cohorts, setCohorts] = useState<string[]>(initialCohorts)
  const [pagination, setPagination] = useState({
    page: initialPagination.page,
    limit: initialPagination.limit,
    total: initialPagination.total,
    pages: initialPagination.pages,
  })

  const [filters, setFilters] = useState<Filters>({
    search: '',
    role: 'ALL',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  // Modal states
  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    user?: User
  }>({
    isOpen: false,
  })

  const [bulkRoleModal, setBulkRoleModal] = useState<{
    isOpen: boolean
    targetRole: UserRole
  }>({
    isOpen: false,
    targetRole: 'PARTICIPANT',
  })

  const [editForm, setEditForm] = useState({
    name: '',
    handle: '',
    school: '',
    cohort: '',
    role: 'PARTICIPANT',
  })

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setErrorString = (msg: string) => setError(msg)

  const columns: ReadonlyArray<Column<UserUI>> = [
    {
      key: 'name',
      header: 'User',
      accessor: (row: UserUI) => ({
        name: row.name,
        handle: row.handle,
        email: row.email,
      }),
      render: (row: UserUI) => {
        const name = row.name ?? ''
        const handle = row.handle ?? ''
        const email = row.email ?? ''
        return (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm">
              {name[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="font-medium">{name}</div>
              <div className="text-sm text-gray-500">@{handle}</div>
              <div className="text-xs text-gray-400">{email}</div>
            </div>
          </div>
        )
      },
      width: '250px',
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (row: UserUI) => row.role,
      render: (row: UserUI) => <StatusBadge status={row.role} />,
      width: '120px',
    },
    {
      key: 'school',
      header: 'School',
      accessor: (row: UserUI) => row.school ?? '',
      render: (row: UserUI) => (row.school && row.school.length > 0 ? row.school : '-') as string,
      width: '150px',
    },
    {
      key: 'cohort',
      header: 'Cohort',
      accessor: (row: UserUI) => row.cohort ?? '',
      render: (row: UserUI) => (row.cohort && row.cohort.length > 0 ? row.cohort : '-') as string,
      width: '100px',
    },
    {
      key: 'totalPoints',
      header: 'Points',
      accessor: (row: UserUI) => row.totalPoints,
      render: (row: UserUI) => (
        <div className="text-right">
          <div className="font-medium">{row.totalPoints}</div>
        </div>
      ),
      width: '80px',
    },
    {
      key: '_count.submissions',
      header: 'Submissions',
      accessor: (row: UserUI) => row._count.submissions,
      render: (row: UserUI) => <div className="text-center">{row._count.submissions}</div>,
      width: '100px',
    },
    {
      key: '_count.earned_badges',
      header: 'Badges',
      accessor: (row: UserUI) => row._count.earned_badges,
      render: (row: UserUI) => <div className="text-center">{row._count.earned_badges}</div>,
      width: '80px',
    },
    {
      key: 'created_at',
      header: 'Joined',
      accessor: (row: UserUI) => row.created_at,
      sortAccessor: (row: UserUI) => new Date(row.created_at),
      render: (row: UserUI) => new Date(row.created_at).toLocaleDateString(),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: User) => (
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
      sortable: false,
    },
  ]

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: UsersQuery = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: filters.sortBy as UsersQuery['sortBy'],
        sortOrder: filters.sortOrder,
        role: filters.role !== 'ALL' ? (filters.role as UsersQuery['role']) : undefined,
        search: filters.search || undefined,
        cohort: filters.cohort !== 'ALL' ? filters.cohort : undefined,
      }

      const api: APIClient = getApiClient()
      const result = await api.getAdminUsers(params)
      const mapped: UserUI[] = result.data.users.map((u: AdminUser) => toUserUI(u))
      setUsers(mapped)
      setPagination((prev) => ({
        ...prev,
        total: result.data.pagination.total,
        pages:
          result.data.pagination.pages ??
          Math.ceil(result.data.pagination.total / prev.limit),
      }))
    } catch (error: unknown) {
      const msg = toMsg('Fetch users', error)
      setErrorString(msg)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  // Optionally refresh cohorts if none provided (non-blocking)
  React.useEffect(() => {
    const fetchCohorts = async () => {
      try {
        const api: APIClient = getApiClient()
        const res = await api.getAdminCohorts()
        setCohorts(Array.isArray(res.data.cohorts) ? res.data.cohorts : [])
      } catch (error: unknown) {
        // Cohorts are optional; surface as non-blocking UI alert
        const msg = toMsg('Cohort fetch', error)
        setErrorString(msg)
      }
    }
    // Only fetch if not already provided
    if (!initialCohorts || initialCohorts.length === 0) void fetchCohorts()
  }, [initialCohorts])

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
    void fetchUsers()
  }

  const isValidUserSortKey = (value: string): value is Filters['sortBy'] =>
    value === 'created_at' || value === 'name' || value === 'email'

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({
      ...prev,
      sortBy: isValidUserSortKey(sortBy) ? sortBy : prev.sortBy,
      sortOrder,
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
    void fetchUsers()
  }

  const openEditModal = (user: User) => {
    setEditModal({ isOpen: true, user })
    setEditForm({
      name: user.name,
      handle: user.handle,
      school: user.school || '',
      cohort: user.cohort || '',
      role: user.role,
    })
  }

  const closeEditModal = () => {
    setEditModal({ isOpen: false })
    setEditForm({
      name: '',
      handle: '',
      school: '',
      cohort: '',
      role: 'PARTICIPANT',
    })
  }

  const handleEditUser = async () => {
    if (!editModal.user) return

    setProcessing(true)
    try {
      type UpdateUserBody = {
        userId: string
        name?: string
        handle?: string
        school?: string
        cohort?: string
        role?: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
      }
      const updateData: UpdateUserBody = {
        userId: editModal.user.id,
      }
      if (editForm.name) updateData.name = editForm.name
      if (editForm.handle) updateData.handle = editForm.handle
      if (editForm.school) updateData.school = editForm.school
      if (editForm.cohort) updateData.cohort = editForm.cohort
      if (editForm.role)
        updateData.role = editForm.role as 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'

      await updateUserAction(updateData)
      await fetchUsers()
      closeEditModal()
    } catch (error: unknown) {
      const msg = toMsg('Failed to update user', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkRoleUpdate = async () => {
    if (selectedRows.size === 0) return

    setProcessing(true)
    try {
      await bulkUpdateUsersAction({
        userIds: Array.from(selectedRows),
        role: bulkRoleModal.targetRole,
      })
      setSelectedRows(new Set())
      await fetchUsers()
      setBulkRoleModal({ isOpen: false, targetRole: 'PARTICIPANT' })
    } catch (error: unknown) {
      const msg = toMsg('Failed to bulk update users', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-md shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="users-filter-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <Input
              id="users-filter-search"
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="users-filter-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <Select
              value={filters.role}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, role: value as Filters['role'] }))}
            >
              <SelectTrigger id="users-filter-role">
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
            <label htmlFor="users-filter-cohort" className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </label>
            <Select value={filters.cohort} onValueChange={(value) => setFilters((prev) => ({ ...prev, cohort: value }))}>
              <SelectTrigger id="users-filter-cohort">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cohorts</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
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
              <span className="text-sm text-gray-600">{selectedRows.size} users selected</span>
              <div className="space-x-2">
                <Select
                  value={bulkRoleModal.targetRole}
                  onValueChange={(value) => setBulkRoleModal((prev) => ({ ...prev, targetRole: value as UserRole }))}
                >
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
                <Button variant="default" onClick={() => setBulkRoleModal((prev) => ({ ...prev, isOpen: true }))}>
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
          onPageChange: handlePageChange,
        }}
        selection={{
          selectedRows,
          onSelectionChange: (rows: Set<string | number>) => setSelectedRows(new Set(Array.from(rows).map(String))),
          getRowId: (row) => row.id,
        }}
        sorting={{
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          onSort: handleSort,
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
            <Button variant="default" onClick={handleEditUser} disabled={processing}>
              {processing ? 'Updating...' : 'Update User'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input
              id="edit-user-name"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>

          <div>
            <label htmlFor="edit-user-handle" className="block text-sm font-medium text-gray-700 mb-1">
              Handle
            </label>
            <Input
              id="edit-user-handle"
              value={editForm.handle}
              onChange={(e) => setEditForm((prev) => ({ ...prev, handle: e.target.value }))}
              placeholder="@username"
            />
          </div>

          <div>
            <label htmlFor="edit-user-school" className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <Input
              id="edit-user-school"
              value={editForm.school}
              onChange={(e) => setEditForm((prev) => ({ ...prev, school: e.target.value }))}
              placeholder="School name"
            />
          </div>

          <div>
            <label htmlFor="edit-user-cohort" className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </label>
            <Select value={editForm.cohort} onValueChange={(value) => setEditForm((prev) => ({ ...prev, cohort: value }))}>
              <SelectTrigger id="edit-user-cohort">
                <SelectValue placeholder="Select cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Cohort</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="edit-user-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <Select value={editForm.role} onValueChange={(value) => setEditForm((prev) => ({ ...prev, role: value }))}>
              <SelectTrigger id="edit-user-role">
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
