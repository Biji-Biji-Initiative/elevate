'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@elevate/ui/Button'
import { Input } from '@elevate/ui/Input'
import { DataTable, Column } from '../../components/ui/DataTable'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { Textarea } from '@elevate/ui/Textarea'

interface Submission {
  id: string
  user: {
    id: string
    name: string
    handle: string
    email: string
    school?: string
    cohort?: string
  }
  activity: {
    code: string
    name: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  visibility: 'PUBLIC' | 'PRIVATE'
  payload: any
  attachments: string[]
  reviewer_id?: string
  review_note?: string
  created_at: string
  updated_at: string
}

interface Filters {
  status: string
  activity: string
  search: string
  cohort: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export default function SubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })
  
  const [filters, setFilters] = useState<Filters>({
    status: 'PENDING',
    activity: 'ALL',
    search: '',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })
  
  // Modal states
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean
    submission?: Submission
    action: 'approve' | 'reject'
  }>({
    isOpen: false,
    action: 'approve'
  })
  
  const [bulkModal, setBulkModal] = useState<{
    isOpen: boolean
    action: 'approve' | 'reject'
  }>({
    isOpen: false,
    action: 'approve'
  })
  
  const [reviewNote, setReviewNote] = useState('')
  const [pointAdjustment, setPointAdjustment] = useState<number | ''>('')
  const [processing, setProcessing] = useState(false)

  const columns: Column<Submission>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
      width: '100px'
    },
    {
      key: 'user.name',
      header: 'Participant',
      render: (row) => (
        <div>
          <div className="font-medium">{row.user.name}</div>
          <div className="text-sm text-gray-500">@{row.user.handle}</div>
          {row.user.school && (
            <div className="text-xs text-gray-400">{row.user.school}</div>
          )}
        </div>
      ),
      width: '200px'
    },
    {
      key: 'activity.name',
      header: 'Activity',
      render: (row) => (
        <div>
          <div className="font-medium">{row.activity.name}</div>
          <div className="text-sm text-gray-500">{row.activity.code}</div>
        </div>
      ),
      width: '120px'
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
      width: '100px'
    },
    {
      key: 'visibility',
      header: 'Visibility',
      render: (row) => <StatusBadge status={row.visibility} size="sm" />,
      width: '80px'
    },
    {
      key: 'attachments',
      header: 'Files',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.attachments?.length || 0} files
        </span>
      ),
      width: '80px',
      sortable: false
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
              router.push(`/admin/review/${row.id}`)
            }}
          >
            View
          </Button>
          {row.status === 'PENDING' && (
            <>
              <Button
                variant="primary"
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  backgroundColor: '#16a34a' 
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  openReviewModal(row, 'approve')
                }}
              >
                Approve
              </Button>
              <Button
                variant="primary"
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  backgroundColor: '#dc2626' 
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  openReviewModal(row, 'reject')
                }}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
      width: '200px',
      sortable: false
    }
  ]

  useEffect(() => {
    fetchSubmissions()
  }, [pagination.page, pagination.limit, filters])

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })

      if (filters.activity !== 'ALL') params.set('activity', filters.activity)
      if (filters.search) params.set('search', filters.search)
      if (filters.cohort !== 'ALL') params.set('cohort', filters.cohort)

      const response = await fetch(`/api/admin/submissions?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setSubmissions(data.submissions)
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          pages: data.pagination.pages
        }))
      } else {
        console.error('Failed to fetch submissions:', data.error)
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
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

  const openReviewModal = (submission: Submission, action: 'approve' | 'reject') => {
    setReviewModal({
      isOpen: true,
      submission,
      action
    })
    setReviewNote('')
    setPointAdjustment('')
  }

  const closeReviewModal = () => {
    setReviewModal({ isOpen: false, action: 'approve' })
    setReviewNote('')
    setPointAdjustment('')
  }

  const handleSingleReview = async () => {
    if (!reviewModal.submission) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: reviewModal.submission.id,
          action: reviewModal.action,
          reviewNote: reviewNote || undefined,
          pointAdjustment: pointAdjustment !== '' ? Number(pointAdjustment) : undefined
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        await fetchSubmissions() // Refresh data
        closeReviewModal()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error reviewing submission:', error)
      alert('Failed to process review')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkAction = async () => {
    if (selectedRows.size === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionIds: Array.from(selectedRows),
          action: bulkModal.action,
          reviewNote: reviewNote || undefined
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setSelectedRows(new Set())
        await fetchSubmissions()
        setBulkModal({ isOpen: false, action: 'approve' })
        setReviewNote('')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error bulk processing:', error)
      alert('Failed to process bulk action')
    } finally {
      setProcessing(false)
    }
  }

  const getBasePoints = (submission: Submission): number => {
    const activityPoints: Record<string, number> = {
      'LEARN': 20,
      'EXPLORE': 50,
      'AMPLIFY': 0, // Calculated based on payload
      'PRESENT': 20,
      'SHINE': 0
    }

    if (submission.activity.code === 'AMPLIFY') {
      const peers = Number(submission.payload?.peersTrained || 0)
      const students = Number(submission.payload?.studentsTrained || 0)
      return Math.min(peers, 50) * 2 + Math.min(students, 200) * 1
    }

    return activityPoints[submission.activity.code] || 0
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Queue</h1>
        <p className="text-gray-600">Review and approve participant submissions</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All Status</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.activity}
              onChange={(e) => setFilters(prev => ({ ...prev, activity: e.target.value }))}
            >
              <option value="ALL">All Activities</option>
              <option value="LEARN">Learn</option>
              <option value="EXPLORE">Explore</option>
              <option value="AMPLIFY">Amplify</option>
              <option value="PRESENT">Present</option>
              <option value="SHINE">Shine</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={fetchSubmissions} style={{ width: '100%' }}>
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRows.size > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedRows.size} submissions selected
              </span>
              <div className="space-x-2">
                <Button
                  variant="primary"
                  style={{ backgroundColor: '#16a34a' }}
                  onClick={() => {
                    setBulkModal({ isOpen: true, action: 'approve' })
                    setReviewNote('')
                  }}
                >
                  Bulk Approve
                </Button>
                <Button
                  variant="primary"
                  style={{ backgroundColor: '#dc2626' }}
                  onClick={() => {
                    setBulkModal({ isOpen: true, action: 'reject' })
                    setReviewNote('')
                  }}
                >
                  Bulk Reject
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        data={submissions}
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
        onRowClick={(row) => router.push(`/admin/review/${row.id}`)}
        emptyMessage="No submissions found matching your criteria"
      />

      {/* Single Review Modal */}
      <Modal
        isOpen={reviewModal.isOpen}
        onClose={closeReviewModal}
        title={`${reviewModal.action === 'approve' ? 'Approve' : 'Reject'} Submission`}
        size="md"
        actions={
          <div className="space-x-3">
            <Button variant="ghost" onClick={closeReviewModal} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSingleReview}
              disabled={processing}
              style={{
                backgroundColor: reviewModal.action === 'approve' ? '#16a34a' : '#dc2626'
              }}
            >
              {processing ? 'Processing...' : reviewModal.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        }
      >
        {reviewModal.submission && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Submission Details</h4>
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p><strong>Participant:</strong> {reviewModal.submission.user.name}</p>
                <p><strong>Activity:</strong> {reviewModal.submission.activity.name}</p>
                <p><strong>Submitted:</strong> {new Date(reviewModal.submission.created_at).toLocaleDateString()}</p>
                {reviewModal.action === 'approve' && (
                  <p><strong>Base Points:</strong> {getBasePoints(reviewModal.submission)}</p>
                )}
              </div>
            </div>

            {reviewModal.action === 'approve' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Point Adjustment (Optional)
                </label>
                <Input
                  type="number"
                  placeholder={`Base points: ${getBasePoints(reviewModal.submission)}`}
                  value={pointAdjustment}
                  onChange={(e) => setPointAdjustment(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use base points. Max ±20% adjustment allowed.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Review Notes (Optional)
              </label>
              <Textarea
                placeholder="Add feedback for the participant..."
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Action Modal */}
      <ConfirmModal
        isOpen={bulkModal.isOpen}
        onClose={() => setBulkModal({ isOpen: false, action: 'approve' })}
        onConfirm={handleBulkAction}
        title={`Bulk ${bulkModal.action === 'approve' ? 'Approve' : 'Reject'}`}
        message={`Are you sure you want to ${bulkModal.action} ${selectedRows.size} submissions?`}
        confirmText={bulkModal.action === 'approve' ? 'Approve All' : 'Reject All'}
        isLoading={processing}
      />
    </div>
  )
}