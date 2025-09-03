'use client'

import React, { useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { withRoleGuard } from '@elevate/auth/context'
import { adminClient, type SubmissionsQuery } from '@/lib/admin-client'
import type { TableFilters, PaginationConfig } from '@elevate/types'
import { Button , Input, DataTable, StatusBadge, Modal, ConfirmModal, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, createColumns, Alert } from '@elevate/ui'
import type { Column } from '@elevate/ui'

// Define Submission type based on what adminClient actually returns
type Submission = {
  id: string
  created_at: string
  updated_at?: string | undefined
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  visibility: 'PUBLIC' | 'PRIVATE'
  review_note?: string | null | undefined
  attachments?: unknown[] | undefined
  user: {
    id: string
    name: string
    handle: string
    email?: string | undefined
    school?: string | null | undefined
    cohort?: string | null | undefined
  }
  activity: {
    code: string
    name: string
    default_points?: number | undefined
  }
}

// Using TableFilters from @elevate/types with proper typing
interface Filters extends TableFilters {
  status: string
  activity: string
  search: string
  cohort: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

function SubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
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
    status: 'PENDING',
    activity: 'ALL',
    search: '',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  useEffect(() => {
    const fetchCohorts = async () => {
      try {
        const result = await adminClient.getCohorts()
        setCohorts(result)
      } catch (error) {
        // Cohorts are optional for UI, don't break on fetch failure
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch cohorts:', error);
        }
      }
    }
    void fetchCohorts()
  }, [])
  
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
  const [error, setError] = useState<string | null>(null)

  const columns = createColumns<Submission>()([
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
      render: (row) => {
        const attachmentCount = typeof row.attachmentCount === 'number'
          ? row.attachmentCount
          : (Array.isArray(row.attachments) ? row.attachments.length : 0)
        return (
          <span className="text-sm text-gray-600">
            {attachmentCount} files
          </span>
        )
      },
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
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation()
              router.push(`/admin/review/${row.id}`)
            }}
          >
            View
          </Button>
          {row.status === 'PENDING' && (
            <>
              <Button
                variant="default"
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  backgroundColor: '#16a34a' 
                }}
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  openReviewModal(row, 'approve')
                }}
              >
                Approve
              </Button>
              <Button
                variant="default"
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  backgroundColor: '#dc2626' 
                }}
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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
  ])

  useEffect(() => {
    void fetchSubmissions()
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

      const { submissions, pagination: pageInfo } = await adminClient.getSubmissions(Object.fromEntries(params) as SubmissionsQuery)
      setSubmissions(submissions)
      setPagination(prev => ({ ...prev, total: pageInfo.total, pages: pageInfo.pages }))
    } catch (error) {
      setError('Failed to fetch submissions')
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
      const reviewData: Parameters<typeof adminClient.reviewSubmission>[0] = {
        submissionId: reviewModal.submission.id,
        action: reviewModal.action,
      }
      if (reviewNote) reviewData.reviewNote = reviewNote
      if (pointAdjustment !== '') reviewData.pointAdjustment = Number(pointAdjustment)
      
      await adminClient.reviewSubmission(reviewData)
      await fetchSubmissions()
      closeReviewModal()
    } catch (error) {
      setError('Failed to process review')
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkAction = async () => {
    if (selectedRows.size === 0) return

    setProcessing(true)
    try {
      const bulkReviewData: Parameters<typeof adminClient.bulkReview>[0] = {
        submissionIds: Array.from(selectedRows),
        action: bulkModal.action,
      }
      if (reviewNote) bulkReviewData.reviewNote = reviewNote
      
      await adminClient.bulkReview(bulkReviewData)
      setSelectedRows(new Set())
      await fetchSubmissions()
      setBulkModal({ isOpen: false, action: 'approve' })
      setReviewNote('')
    } catch (error) {
      setError('Failed to process bulk action')
    } finally {
      setProcessing(false)
    }
  }

  const getBasePoints = (submission: Submission): number => {
    const activityPoints: Readonly<Record<string, number>> = {
      'LEARN': 20,
      'EXPLORE': 50,
      'AMPLIFY': 0, // Calculated based on payload
      'PRESENT': 20,
      'SHINE': 0
    } as const

    // Note: The adminClient doesn't return payload data for submissions
    // This calculation would need the payload to be included in the SubmissionSchema
    // For now, returning default points
    if (submission.activity.code === 'AMPLIFY') {
      // TODO: Add payload to SubmissionSchema in adminClient
      return submission.activity.default_points || 0
    }

    return activityPoints[submission.activity.code] ?? 0
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Queue</h1>
        <p className="text-gray-600">Review and approve participant submissions</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div>
            <label id="submissions-filter-status-label" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger aria-labelledby="submissions-filter-status-label">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ALL">All Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label id="submissions-filter-activity-label" className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <Select value={filters.activity} onValueChange={(value) => setFilters(prev => ({ ...prev, activity: value }))}>
              <SelectTrigger aria-labelledby="submissions-filter-activity-label">
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Activities</SelectItem>
                <SelectItem value="LEARN">Learn</SelectItem>
                <SelectItem value="EXPLORE">Explore</SelectItem>
                <SelectItem value="AMPLIFY">Amplify</SelectItem>
                <SelectItem value="PRESENT">Present</SelectItem>
                <SelectItem value="SHINE">Shine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label id="submissions-filter-cohort-label" className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <Select value={filters.cohort} onValueChange={(value) => setFilters(prev => ({ ...prev, cohort: value }))}>
              <SelectTrigger aria-labelledby="submissions-filter-cohort-label">
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
                  variant="default"
                  style={{ backgroundColor: '#16a34a' }}
                  onClick={() => {
                    setBulkModal({ isOpen: true, action: 'approve' })
                    setReviewNote('')
                  }}
                >
                  Bulk Approve
                </Button>
                <Button
                  variant="default"
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
      <DataTable<Submission>
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
              variant="default"
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
              <label htmlFor="point-adjustment-input" className="block text-sm font-medium text-gray-700 mb-1">
                Point Adjustment (Optional)
              </label>
              <Input
                id="point-adjustment-input"
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
              <label htmlFor="review-notes-textarea" className="block text-sm font-medium text-gray-700 mb-1">
                Review Notes (Optional)
              </label>
              <Textarea
                id="review-notes-textarea"
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

export default withRoleGuard(SubmissionsPage, ['reviewer', 'admin', 'superadmin'])
