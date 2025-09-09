'use client'

import React, { useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { adminClient, type SubmissionsQuery, type AdminSubmission, type Pagination } from '@/lib/admin-client'
import { handleApiError } from '@/lib/error-utils'
import { withRoleGuard } from '@elevate/auth/context'
import { ACTIVITY_CODES, SUBMISSION_STATUSES, ACTIVITY_FILTER_OPTIONS, STATUS_FILTER_OPTIONS, AMPLIFY } from '@elevate/types'
import { Button, Input, Textarea, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui'
import { DataTable, StatusBadge, Modal, ConfirmModal, createColumns } from '@elevate/ui/blocks'

// Define proper filter types for submissions
interface Filters {
  status: typeof STATUS_FILTER_OPTIONS[number]
  activity: typeof ACTIVITY_FILTER_OPTIONS[number]
  search: string
  cohort: string
  sortBy: 'created_at' | 'updated_at' | 'status'
  sortOrder: 'asc' | 'desc'
}

function SubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [cohorts, setCohorts] = useState<string[]>([])
  
  const [filters, setFilters] = useState<Filters>({
    status: STATUS_FILTER_OPTIONS[1], // PENDING
    activity: ACTIVITY_FILTER_OPTIONS[0], // ALL
    search: '',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc'
  })

  useEffect(() => {
    const fetchCohorts = async () => {
      try {
        const cohortData = await adminClient.getCohorts()
        setCohorts(cohortData)
      } catch (error: unknown) {
        // Cohorts are optional for UI, don't break on fetch failure
        console.warn('Failed to fetch cohorts:', handleApiError(error, 'Cohort fetch'))
      }
    }
    void fetchCohorts()
  }, [])
  
  // Modal states
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean
    submission?: AdminSubmission
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

  const columns = createColumns<AdminSubmission>()([
    {
      key: 'created_at',
      header: 'Date',
      accessor: (row: AdminSubmission) => row.created_at,
      sortAccessor: (row: AdminSubmission) => new Date(row.created_at),
      render: (row: AdminSubmission) => new Date(row.created_at).toLocaleDateString(),
      width: '100px'
    },
    {
      key: 'user.name',
      header: 'Participant',
      accessor: (row: AdminSubmission) => ({ name: row.user.name, handle: row.user.handle, school: row.user.school ?? '' }),
      sortAccessor: (row: AdminSubmission) => row.user.name,
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
      accessor: (row: AdminSubmission) => ({ name: row.activity.name, code: row.activity.code }),
      sortAccessor: (row: AdminSubmission) => row.activity.name,
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
      accessor: (row: AdminSubmission) => row.status,
      render: (_row, value?: string) => <StatusBadge status={value ?? ''} />,
      width: '100px'
    },
    {
      key: 'visibility',
      header: 'Visibility',
      accessor: (row: AdminSubmission) => row.visibility,
      render: (_row, value?: string) => <StatusBadge status={value ?? ''} size="sm" />,
      width: '80px'
    },
    {
      key: 'attachments',
      header: 'Files',
      accessor: (row: AdminSubmission) => row.attachmentCount ?? 0,
      render: (_row, value?: number) => (
        <span className="text-sm text-gray-600">{value ?? 0} files</span>
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
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation()
              router.push(`/admin/review/${row.id}`)
            }}
          >
            View
          </Button>
          {row.status === SUBMISSION_STATUSES[0] && ( // PENDING
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
      const params: SubmissionsQuery = {
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status !== 'ALL' ? filters.status : undefined,
        activity: filters.activity !== 'ALL' ? filters.activity : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        search: filters.search || undefined,
        cohort: filters.cohort !== 'ALL' ? filters.cohort : undefined
      }

      const result = await adminClient.getSubmissions(params)
      
      setSubmissions(result.submissions)
      setPagination(result.pagination)
    } catch (error: unknown) {
      setError(handleApiError(error, 'Fetch submissions'))
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

  const openReviewModal = (submission: AdminSubmission, action: 'approve' | 'reject') => {
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
    } catch (error: unknown) {
      setError(handleApiError(error, 'Process review'))
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
    } catch (error: unknown) {
      setError(handleApiError(error, 'Process bulk action'))
    } finally {
      setProcessing(false)
    }
  }

  const getBasePoints = (submission: AdminSubmission): number => {
    const activityPoints: Readonly<Record<string, number>> = {
      [ACTIVITY_CODES[0]]: 20, // LEARN
      [ACTIVITY_CODES[1]]: 50, // EXPLORE
      [ACTIVITY_CODES[2]]: 0, // AMPLIFY - Calculated based on payload
      [ACTIVITY_CODES[3]]: 20, // PRESENT
      [ACTIVITY_CODES[4]]: 0 // SHINE
    } as const

    // Note: The adminClient doesn't return payload data for submissions
    // This calculation would need the payload to be included in the SubmissionSchema
    // For now, returning default points
    if (submission.activity.code === AMPLIFY) {
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
                <SelectItem value={SUBMISSION_STATUSES[0]}>Pending</SelectItem>
                <SelectItem value={SUBMISSION_STATUSES[1]}>Approved</SelectItem>
                <SelectItem value={SUBMISSION_STATUSES[2]}>Rejected</SelectItem>
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
                <SelectItem value={ACTIVITY_CODES[0]}>Learn</SelectItem>
                <SelectItem value={ACTIVITY_CODES[1]}>Explore</SelectItem>
                <SelectItem value={ACTIVITY_CODES[2]}>Amplify</SelectItem>
                <SelectItem value={ACTIVITY_CODES[3]}>Present</SelectItem>
                <SelectItem value={ACTIVITY_CODES[4]}>Shine</SelectItem>
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
            <label htmlFor="submissions-filter-search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              id="submissions-filter-search"
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
      <DataTable<AdminSubmission>
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
