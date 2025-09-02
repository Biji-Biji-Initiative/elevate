'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@elevate/ui'
import { Input } from '@elevate/ui/Input'
import { DataTable, Column } from '../../components/ui/DataTable'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Modal, ConfirmModal } from '../../components/ui/Modal'

interface User {
  id: string
  handle: string
  name: string
  email: string
  avatar_url?: string
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  school?: string
  cohort?: string
  created_at: string
  totalPoints: number
  _count: {
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
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

  const columns: Column<User>[] = [
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
  ]

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, pagination.limit, filters])

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

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          pages: data.pagination.pages
        }))
      } else {
        console.error('Failed to fetch users:', data.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
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
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editModal.user.id,
          ...editForm
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchUsers() // Refresh data
        closeEditModal()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkRoleUpdate = async () => {
    if (selectedRows.size === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedRows),
          role: bulkRoleModal.targetRole
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setSelectedRows(new Set())
        await fetchUsers()
        setBulkRoleModal({ isOpen: false, targetRole: 'PARTICIPANT' })
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error bulk updating roles:', error)
      alert('Failed to update user roles')
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              placeholder="Search by name, email, handle..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            >
              <option value="ALL">All Roles</option>
              <option value="PARTICIPANT">Participant</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.cohort}
              onChange={(e) => setFilters(prev => ({ ...prev, cohort: e.target.value }))}
            >
              <option value="ALL">All Cohorts</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
            </select>
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
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bulkRoleModal.targetRole}
                  onChange={(e) => setBulkRoleModal(prev => ({ ...prev, targetRole: e.target.value }))}
                >
                  <option value="PARTICIPANT">Participant</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Superadmin</option>
                </select>
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
      <DataTable
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
            <Input
              value={editForm.handle}
              onChange={(e) => setEditForm(prev => ({ ...prev, handle: e.target.value }))}
              placeholder="@username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
            <Input
              value={editForm.school}
              onChange={(e) => setEditForm(prev => ({ ...prev, school: e.target.value }))}
              placeholder="School name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editForm.cohort}
              onChange={(e) => setEditForm(prev => ({ ...prev, cohort: e.target.value }))}
            >
              <option value="">No Cohort</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editForm.role}
              onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
            >
              <option value="PARTICIPANT">Participant</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPERADMIN">Superadmin</option>
            </select>
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

