'use client'

import React, { useState, useCallback } from 'react'

import Link from 'next/link'

import { inviteKajabiAction } from '@/lib/actions/kajabi'
import { listUsersAction, updateUserAction, bulkUpdateUsersAction, bulkUpdateLeapsUsersAction } from '@/lib/actions/users'
import { toMsg } from '@/lib/errors'
import { useAdminFilters } from '@/lib/hooks/useAdminFilters'
import { useCohorts } from '@/lib/hooks/useCohorts'
import { useModal } from '@/lib/hooks/useModal'
import { useSelection } from '@/lib/hooks/useSelection'
import { toUserUI, type UserUI } from '@/lib/ui-types'
import type { UserRole } from '@elevate/types'
import type { AdminUser } from '@elevate/types/admin-api-types'
import { Button, Input, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui'
import { DataTable, StatusBadge, Modal, ConfirmModal, type Column } from '@elevate/ui/blocks'
import { buildQueryString } from '@/lib/utils/query'

type User = UserUI

interface Filters extends Record<string, unknown> {
  search: string
  role: UserRole | 'ALL'
  userType: 'ALL' | 'EDUCATOR' | 'STUDENT'
  kajabi: 'ALL' | 'LINKED' | 'UNLINKED'
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
  const { selected: selectedRows, setSelected: setSelectedRows, clear } = useSelection<string>()
  const { cohorts } = useCohorts(initialCohorts)
  const [pagination, setPagination] = useState({
    page: initialPagination.page,
    limit: initialPagination.limit,
    total: initialPagination.total,
    pages: initialPagination.pages,
  })

  const { filters, setFilter, setFilters } = useAdminFilters<Filters>({
    search: '',
    role: 'ALL',
    userType: 'ALL',
    kajabi: 'ALL',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  // Modal states
  const editModal = useModal<User>()
  const bulkRoleModal = useModal<UserRole>()
  const [bulkLeapsOpen, setBulkLeapsOpen] = useState(false)
  const [bulkLeapsUserType, setBulkLeapsUserType] = useState<'EDUCATOR' | 'STUDENT'>('EDUCATOR')
  const [bulkLeapsConfirmed, setBulkLeapsConfirmed] = useState<boolean>(true)

  const [editForm, setEditForm] = useState({
    name: '',
    handle: '',
    school: '',
    cohort: '',
    role: 'PARTICIPANT',
  })

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerTarget, setOfferTarget] = useState<string | null>(null)
  const [offerInput, setOfferInput] = useState('')
  const setErrorString = (msg: string) => setError(msg)
  const clerkDashboardBase = process.env.NEXT_PUBLIC_CLERK_DASHBOARD_URL || ''
  const handleExportCsv = () => {
    const headers = ['ID','Name','Handle','Email','Role','LEAPS Role','Confirmed','School','Cohort','Points','Joined']
    const rows = users.map(u => [
      u.id,
      u.name,
      u.handle,
      u.email,
      u.role,
      u.userType ?? '',
      u.userTypeConfirmed ? 'yes' : 'no',
      u.school ?? '',
      u.cohort ?? '',
      String(u.totalPoints ?? 0),
      u.created_at,
    ])
    const csv = [headers, ...rows].map(r => r.map((v) => {
      let s = String(v ?? '')
      const first = s.charAt(0)
      if (first && ['=', '+', '-', '@'].includes(first)) {
        s = `'${s}`
      }
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const buildServerExportUrl = () => {
    const qs = buildQueryString({
      search: filters.search || undefined,
      role: filters.role !== 'ALL' ? filters.role : undefined,
      userType: filters.userType !== 'ALL' ? filters.userType : undefined,
      kajabi: filters.kajabi !== 'ALL' ? filters.kajabi : undefined,
      cohort: filters.cohort !== 'ALL' ? filters.cohort : undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })
    return `/api/admin/users/export.csv?${qs}`
  }

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
      key: 'userType',
      header: 'LEAPS',
      accessor: (row: UserUI) => row.userType ?? '—',
      render: (row: UserUI) => (
        <Select
          value={row.userType ?? 'STUDENT'}
          onValueChange={async (value) => {
            try {
              setProcessing(true)
              await bulkUpdateLeapsUsersAction({ userIds: [row.id], userType: value as 'EDUCATOR' | 'STUDENT' })
              setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, userType: value as 'EDUCATOR' | 'STUDENT' } : u)))
            } catch (err) {
              setErrorString(toMsg('LEAPS role update', err))
            } finally {
              setProcessing(false)
            }
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EDUCATOR">Educator</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
          </SelectContent>
        </Select>
      ),
      width: '140px',
    },
    {
      key: 'userTypeConfirmed',
      header: 'Confirmed',
      accessor: (row: UserUI) => (row.userTypeConfirmed ? 'Yes' : 'No'),
      render: (row: UserUI) => (
        <div className="flex items-center gap-2">
          <span>{row.userTypeConfirmed ? 'Yes' : 'No'}</span>
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={async (e) => {
              e.stopPropagation()
              try {
                setProcessing(true)
                await bulkUpdateLeapsUsersAction({ userIds: [row.id], userTypeConfirmed: !row.userTypeConfirmed })
                setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, userTypeConfirmed: !row.userTypeConfirmed } : u)))
              } catch (err) {
                setErrorString(toMsg('Toggle confirmed', err))
              } finally {
                setProcessing(false)
              }
            }}
          >
            Toggle
          </Button>
        </div>
      ),
      width: '100px',
    },
    {
      key: 'kajabiLinked',
      header: 'Kajabi',
      accessor: (row: UserUI) => (row.kajabiLinked ? 'Yes' : 'No'),
      render: (row: UserUI) => (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${row.kajabiLinked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {row.kajabiLinked ? '✅ Linked' : '—'}
          </span>
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={async (e) => {
              e.stopPropagation()
              setProcessing(true)
              setError(null)
              setInfo(null)
              try {
                const json = await inviteKajabiAction({ userId: row.id })
                setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, kajabiLinked: true } : u)))
                setInfo(`Kajabi invite sent for ${row.handle} (contactId: ${json?.contactId ?? 'unknown'})`)
              } catch (err) {
                setErrorString(toMsg('Kajabi invite', err))
              } finally {
                setProcessing(false)
              }
            }}
          >
            {row.kajabiLinked ? 'Re-enroll' : 'Enroll'}
          </Button>
          <Button
            variant="ghost"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={(e) => {
              e.stopPropagation()
              setOfferTarget(row.id)
              setOfferInput('')
              setOfferOpen(true)
            }}
          >
            Grant Offer
          </Button>
        </div>
      ),
      width: '180px',
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
      key: 'actions',
      header: 'Actions',
      accessor: () => '',
      render: (row: UserUI) => (
        <div className="flex items-center gap-2">
          <Link href={`./${row.id}`} className="text-blue-600 hover:underline">
            Manage LEAPS
          </Link>
        </div>
      ),
      width: '140px',
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
          <Link
            href={`./audit?${buildQueryString({ targetId: row.id })}`}
            className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            Audit Logs
          </Link>
          {clerkDashboardBase && (
            <a
              href={`${clerkDashboardBase.replace(/\/$/, '')}/users/${encodeURIComponent(row.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-2 py-1 text-xs rounded border hover:bg-gray-50"
              onClick={(e) => e.stopPropagation()}
            >
              Open in Clerk
            </a>
          )}
        </div>
      ),
      width: '80px',
      sortable: false,
    },
  ]

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }
      if (filters.role !== 'ALL') params.role = filters.role
      if (filters.userType !== 'ALL') params.userType = filters.userType
      if (filters.kajabi !== 'ALL') params.kajabi = filters.kajabi
      if (filters.search) params.search = filters.search
      if (filters.cohort !== 'ALL') params.cohort = filters.cohort

      const result = await listUsersAction(params)
      const mapped: UserUI[] = result.users.map((u: AdminUser) => toUserUI(u))
      setUsers(mapped)
      setPagination((prev) => ({
        ...prev,
        total: result.pagination.total,
        pages:
          result.pagination.pages ??
          Math.ceil(result.pagination.total / prev.limit),
      }))
    } catch (error: unknown) {
      const msg = toMsg('Fetch users', error)
      setErrorString(msg)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  // Optionally refresh cohorts if none provided (non-blocking)
  // Cohorts auto-fetch via useCohorts when initial list empty

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
    void fetchUsers()
  }

  const isValidUserSortKey = (value: string): value is Filters['sortBy'] =>
    value === 'created_at' || value === 'name' || value === 'email'

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy: isValidUserSortKey(sortBy) ? sortBy : prev.sortBy, sortOrder }))
    setPagination((prev) => ({ ...prev, page: 1 }))
    void fetchUsers()
  }

  const openEditModal = (user: User) => {
    editModal.open(user)
    setEditForm({
      name: user.name,
      handle: user.handle,
      school: user.school || '',
      cohort: user.cohort || '',
      role: user.role,
    })
  }

  const closeEditModal = () => {
    editModal.close()
    setEditForm({
      name: '',
      handle: '',
      school: '',
      cohort: '',
      role: 'PARTICIPANT',
    })
  }

  const handleEditUser = async () => {
    if (!editModal.data) return

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
        userId: editModal.data.id,
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
        role: (bulkRoleModal.data ?? 'PARTICIPANT'),
      })
      clear()
      await fetchUsers()
      bulkRoleModal.close()
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label htmlFor="users-filter-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <Input
              id="users-filter-search"
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="users-filter-role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <Select
              value={filters.role}
              onValueChange={(value) => setFilter('role', value as Filters['role'])}
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
            <label htmlFor="users-filter-userType" className="block text-sm font-medium text-gray-700 mb-1">
              LEAPS Role
            </label>
            <Select
              value={filters.userType}
              onValueChange={(value) => setFilter('userType', value as Filters['userType'])}
            >
              <SelectTrigger id="users-filter-userType">
                <SelectValue placeholder="Select LEAPS role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="EDUCATOR">Educator</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="users-filter-kajabi" className="block text-sm font-medium text-gray-700 mb-1">
              Kajabi
            </label>
            <Select
              value={filters.kajabi}
              onValueChange={(value) => setFilter('kajabi', value as Filters['kajabi'])}
            >
              <SelectTrigger id="users-filter-kajabi">
                <SelectValue placeholder="Filter Kajabi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="LINKED">Linked</SelectItem>
                <SelectItem value="UNLINKED">Unlinked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="users-filter-cohort" className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </label>
            <Select value={filters.cohort} onValueChange={(value) => setFilter('cohort', value)}>
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

          <div className="flex items-end gap-2">
            <Button onClick={fetchUsers} style={{ width: '100%' }}>
              Apply Filters
            </Button>
            <Button variant="ghost" onClick={handleExportCsv}>Export CSV</Button>
            <a href={buildServerExportUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 text-sm rounded border hover:bg-gray-50">
              Server Export
            </a>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRows.size > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{selectedRows.size} users selected</span>
              <div className="space-x-2">
                <Select
                  value={bulkRoleModal.data ?? 'PARTICIPANT'}
                  onValueChange={(value) => bulkRoleModal.open(value as UserRole)}
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
                <Button variant="default" onClick={() => bulkRoleModal.open(bulkRoleModal.data ?? 'PARTICIPANT')}>
                  Update Roles
                </Button>
                <Button variant="ghost" onClick={() => setBulkLeapsOpen(true)}>
                  Update LEAPS
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (selectedRows.size === 0) return
                    setProcessing(true)
                    setError(null)
                    setInfo(null)
                    try {
                      await bulkUpdateLeapsUsersAction({ userIds: Array.from(selectedRows), userTypeConfirmed: true })
                      setUsers((prev) => prev.map((u) => (selectedRows.has(u.id) ? { ...u, userTypeConfirmed: true } : u)))
                      setInfo(`${selectedRows.size} users marked as confirmed`)
                      clear()
                    } catch (e) {
                      setErrorString(toMsg('Bulk confirm', e))
                    } finally {
                      setProcessing(false)
                    }
                  }}
                >
                  Mark Confirmed
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    if (selectedRows.size === 0) return
                    setProcessing(true)
                    setError(null)
                    setInfo(null)
                    try {
                      await bulkUpdateLeapsUsersAction({ userIds: Array.from(selectedRows), userTypeConfirmed: false })
                      setUsers((prev) => prev.map((u) => (selectedRows.has(u.id) ? { ...u, userTypeConfirmed: false } : u)))
                      setInfo(`${selectedRows.size} users marked as unconfirmed`)
                      clear()
                    } catch (e) {
                      setErrorString(toMsg('Bulk unconfirm', e))
                    } finally {
                      setProcessing(false)
                    }
                  }}
                >
                  Mark Unconfirmed
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
      {info && (
        <div className="mb-4">
          <Alert>{info}</Alert>
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
        onClose={() => bulkRoleModal.close()}
        onConfirm={handleBulkRoleUpdate}
        title="Update User Roles"
        message={`Are you sure you want to update ${selectedRows.size} users to ${bulkRoleModal.data ?? 'PARTICIPANT'} role?`}
        confirmText="Update Roles"
        isLoading={processing}
      />

      {/* Bulk LEAPS Update Modal */}
      {bulkLeapsOpen && (
        <Modal
          isOpen={bulkLeapsOpen}
          onClose={() => setBulkLeapsOpen(false)}
          title="Bulk Update LEAPS Profile"
          size="md"
          actions={
            <div className="space-x-3">
              <Button variant="ghost" onClick={() => setBulkLeapsOpen(false)} disabled={processing}>Cancel</Button>
              <Button
                variant="default"
                onClick={async () => {
                  setProcessing(true)
                  setError(null)
                  try {
                    await bulkUpdateLeapsUsersAction({ userIds: Array.from(selectedRows), userType: bulkLeapsUserType, userTypeConfirmed: bulkLeapsConfirmed })
                    setBulkLeapsOpen(false)
                    clear()
                    await fetchUsers()
                  } catch (e) {
                    setError(toMsg('Bulk LEAPS update', e))
                  } finally {
                    setProcessing(false)
                  }
                }}
                disabled={processing}
              >
                {processing ? 'Updating…' : 'Update LEAPS'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">LEAPS Role</div>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulk_leaps_ut" checked={bulkLeapsUserType === 'EDUCATOR'} onChange={() => setBulkLeapsUserType('EDUCATOR')} />
                Educator
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="bulk_leaps_ut" checked={bulkLeapsUserType === 'STUDENT'} onChange={() => setBulkLeapsUserType('STUDENT')} />
                Student
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bulkLeapsConfirmed} onChange={(e) => setBulkLeapsConfirmed(e.target.checked)} />
                Mark role as confirmed (onboarding complete)
              </label>
            </div>
            <div className="text-sm text-gray-500">This will update LEAPS role for {selectedRows.size} users and mirror changes to Clerk user metadata.</div>
          </div>
        </Modal>
      )}

      {/* Grant Offer Modal */}
      <Modal
        isOpen={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Grant Kajabi Offer"
        size="sm"
        actions={
          <div className="space-x-3">
            <Button variant="ghost" onClick={() => setOfferOpen(false)} disabled={processing}>Cancel</Button>
            <Button
              variant="default"
              disabled={processing || !offerTarget}
              onClick={async () => {
                if (!offerTarget) return
                setProcessing(true)
                setError(null)
                setInfo(null)
                try {
                  const body = offerInput.trim().length > 0 ? { userId: offerTarget, offerId: offerInput.trim() } : { userId: offerTarget }
                  const json = await inviteKajabiAction(body)
                  setUsers((prev) => prev.map((u) => (u.id === offerTarget ? { ...u, kajabiLinked: true } : u)))
                  setInfo(`Offer grant queued (contactId: ${json?.contactId ?? 'unknown'})`)
                  setOfferOpen(false)
                } catch (err) {
                  setErrorString(toMsg('Kajabi grant', err))
                } finally {
                  setProcessing(false)
                }
              }}
            >
              {processing ? 'Granting…' : 'Grant Offer'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <label htmlFor="offer-id-input" className="block text-sm font-medium text-gray-700">Offer ID (optional)</label>
          <Input
            id="offer-id-input"
            placeholder="Enter Offer ID (optional)"
            value={offerInput}
            onChange={(e) => setOfferInput(e.target.value)}
          />
          <p className="text-xs text-gray-500">Leave blank to just enroll the user without granting an offer.</p>
        </div>
      </Modal>
    </div>
  )
}
