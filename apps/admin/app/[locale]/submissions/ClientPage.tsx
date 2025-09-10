"use client"

import React, { useCallback, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { toMsg } from '@/lib/errors'
import { toSubmissionRowUI, type SubmissionRowUI } from '@/lib/ui-types'
import {
  ACTIVITY_CODES,
  SUBMISSION_STATUSES,
  ACTIVITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  AMPLIFY,
} from '@elevate/types'
import type { SubmissionsQuery, AdminSubmission, Pagination } from '@elevate/types/admin-api-types'
import { reviewSubmissionAction, bulkReviewAction, getSubmissionByIdAction, listSubmissionsAction } from '@/lib/actions/submissions'
import { Button, Input, Textarea, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@elevate/ui'
import { DataTable, StatusBadge, Modal, ConfirmModal, type Column } from '@elevate/ui/blocks'

// Filters model for client UI state
interface Filters {
  status: (typeof STATUS_FILTER_OPTIONS)[number]
  activity: (typeof ACTIVITY_FILTER_OPTIONS)[number]
  search: string
  cohort: string
  sortBy: 'created_at' | 'updated_at' | 'status'
  sortOrder: 'asc' | 'desc'
}

type SubmissionRow = SubmissionRowUI

type Props = {
  initialRows: SubmissionRowUI[]
  initialPagination: Pagination & { total?: number; pages?: number }
  initialCohorts: string[]
}

export function ClientPage({
  initialRows,
  initialPagination,
  initialCohorts,
}: Props) {
  const router = useRouter()

  const [submissions, setSubmissions] = useState<SubmissionRowUI[]>(initialRows)
  const [pagination, setPagination] = useState<
    Pagination & { total?: number; pages?: number }
  >(initialPagination)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [cohorts] = useState<string[]>(initialCohorts)

  const [filters, setFilters] = useState<Filters>({
    status: STATUS_FILTER_OPTIONS[1], // PENDING
    activity: ACTIVITY_FILTER_OPTIONS[0], // ALL
    search: '',
    cohort: 'ALL',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  const setErrorString = (msg: string) => setError(msg)

  const columns: ReadonlyArray<Column<SubmissionRow>> = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'Date',
        accessor: (row) => row.created_at,
        sortAccessor: (row) => new Date(row.created_at),
        render: (row) => new Date(row.created_at).toLocaleDateString(),
        width: '100px',
      },
      {
        key: 'user.name',
        header: 'Participant',
        accessor: (row) => ({
          name: row.user.name,
          handle: row.user.handle,
          school: row.user.school ?? '',
        }),
        sortAccessor: (row) => row.user.name,
        render: (row) => (
          <div>
            <div className="font-medium">{row.user.name}</div>
            <div className="text-sm text-gray-500">@{row.user.handle}</div>
            {row.user.school && (
              <div className="text-xs text-gray-400">{row.user.school}</div>
            )}
          </div>
        ),
        width: '200px',
      },
      {
        key: 'activity.name',
        header: 'Activity',
        accessor: (row) => ({
          name: row.activity.name,
          code: row.activity.code,
        }),
        sortAccessor: (row) => row.activity.name,
        render: (row) => (
          <div>
            <div className="font-medium">{row.activity.name}</div>
            <div className="text-sm text-gray-500">{row.activity.code}</div>
          </div>
        ),
        width: '120px',
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} />,
        width: '100px',
      },
      {
        key: 'visibility',
        header: 'Visibility',
        accessor: (row) => row.visibility,
        render: (row) => <StatusBadge status={row.visibility} size="sm" />,
        width: '80px',
      },
      {
        key: 'attachments',
        header: 'Files',
        accessor: (row) => row.attachmentCount ?? 0,
        render: (row) => (
          <span className="text-sm text-gray-600">{row.attachmentCount ?? 0} files</span>
        ),
        width: '80px',
        sortable: false,
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              className="py-1 px-2 text-[12px]"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                router.push(`/admin/review/${row.id}`)
              }}
            >
              View
            </Button>
            {row.status === SUBMISSION_STATUSES[0] && (
              <>
                <Button
                  variant="default"
                  className="py-1 px-2 text-[12px] bg-emerald-600"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation()
                    void openReviewModalById(row.id, 'approve')
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="default"
                  className="py-1 px-2 text-[12px] bg-red-600"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation()
                    void openReviewModalById(row.id, 'reject')
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        ),
        width: '200px',
        sortable: false,
      },
    ],
    [],
  )

  const fetchSubmissions = useCallback(async () => {
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
        cohort: filters.cohort !== 'ALL' ? filters.cohort : undefined,
      }

      const result = await listSubmissionsAction(params as Record<string, string | number>)
      setSubmissions(result.submissions.map(toSubmissionRowUI))
      setPagination((prev) => {
        const page = result.pagination.page ?? prev.page
        const limit = result.pagination.limit ?? prev.limit
        const total = result.pagination.total ?? prev.total ?? 0
        const pages = Math.ceil(total / limit)
        return { ...prev, page, limit, total, pages }
      })
    } catch (error: unknown) {
      const msg: string = toMsg('Fetch submissions', error)
      setErrorString(msg)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const isValidSortKey = (value: string): value is Filters['sortBy'] =>
    value === 'created_at' || value === 'updated_at' || value === 'status'

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({
      ...prev,
      sortBy: isValidSortKey(sortBy) ? sortBy : prev.sortBy,
      sortOrder,
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean
    submission?: AdminSubmission
    action: 'approve' | 'reject'
  }>({ isOpen: false, action: 'approve' })
  const [reviewLoading, setReviewLoading] = useState(false)
  const [bulkModal, setBulkModal] = useState<{ isOpen: boolean; action: 'approve' | 'reject' }>(
    { isOpen: false, action: 'approve' },
  )
  const [reviewNote, setReviewNote] = useState('')
  const [pointAdjustment, setPointAdjustment] = useState<number | ''>('')
  const [processing, setProcessing] = useState(false)

  const getBasePoints = (submission: AdminSubmission): number => {
    const code = submission.activity.code
    const payload = submission.payload
    const isLearn = code === ACTIVITY_CODES[0] // LEARN
    if (isLearn) return AMPLIFY.DEFAULT_POINTS
    const defaultPoints = submission.activity.default_points ?? 0
    if (typeof payload === 'object' && payload && 'points' in payload) {
      const p = (payload as Record<string, unknown>).points
      if (typeof p === 'number') return p
    }
    return defaultPoints
  }

  const openReviewModalById = async (
    submissionId: string,
    action: 'approve' | 'reject',
  ) => {
    setReviewLoading(true)
    setReviewModal({ isOpen: true, action })
    setReviewNote('')
    setPointAdjustment('')
    try {
      const detail = await getSubmissionByIdAction(submissionId)
      setReviewModal((prev) => ({ ...prev, submission: detail.submission }))
    } catch (error: unknown) {
      const msg: string = toMsg('Fetch submission for review', error)
      setErrorString(msg)
      setReviewModal({ isOpen: false, action: 'approve' })
    } finally {
      setReviewLoading(false)
    }
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
      const reviewData: {
        submissionId: string
        action: 'approve' | 'reject'
        reviewNote?: string
        pointAdjustment?: number
      } = {
        submissionId: reviewModal.submission.id,
        action: reviewModal.action,
        ...(reviewNote ? { reviewNote } : {}),
        ...(pointAdjustment === '' ? {} : { pointAdjustment: Number(pointAdjustment) }),
      }
      await reviewSubmissionAction(reviewData)
      await fetchSubmissions()
      closeReviewModal()
    } catch (error: unknown) {
      const msg: string = toMsg('Process review', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkAction = async () => {
    if (selectedRows.size === 0) return
    setProcessing(true)
    try {
      const bulkReviewData: {
        submissionIds: string[]
        action: 'approve' | 'reject'
        reviewNote?: string
      } = {
        submissionIds: Array.from(selectedRows),
        action: bulkModal.action,
        ...(reviewNote ? { reviewNote } : {}),
      }
      await bulkReviewAction(bulkReviewData)
      setSelectedRows(new Set())
      await fetchSubmissions()
      setBulkModal({ isOpen: false, action: 'approve' })
    } catch (error: unknown) {
      const msg: string = toMsg('Bulk review', error)
      setErrorString(msg)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Review and manage participant submissions.
        </p>
      </div>

      {/* Error */}
      {error && (
        <Alert
          variant="destructive"
          title="Something went wrong"
          description={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <Select
              value={filters.status}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, status: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Activity
            </label>
            <Select
              value={filters.activity}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, activity: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cohort
            </label>
            <Select
              value={filters.cohort}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, cohort: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <Select
              value={filters.sortBy}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  sortBy: isValidSortKey(v) ? v : prev.sortBy,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created</SelectItem>
                <SelectItem value="updated_at">Updated</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <Select
              value={filters.sortOrder}
              onValueChange={(v: 'asc' | 'desc') =>
                setFilters((prev) => ({ ...prev, sortOrder: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <Input
              id="submissions-filter-search"
              placeholder="Search by name, email..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>

          <div className="flex items-end">
            <Button onClick={fetchSubmissions} className="w-full">
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
                  className="bg-emerald-600"
                  onClick={() => {
                    setBulkModal({ isOpen: true, action: 'approve' })
                    setReviewNote('')
                  }}
                >
                  Bulk Approve
                </Button>
                <Button
                  variant="default"
                  className="bg-red-600"
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
      <DataTable<SubmissionRow>
        data={submissions}
        columns={columns}
        loading={loading}
        pagination={{
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total ?? 0,
          onPageChange: handlePageChange,
        }}
        selection={{
          selectedRows,
          onSelectionChange: (rows: Set<string | number>) =>
            setSelectedRows(new Set(Array.from(rows).map(String))),
          getRowId: (row) => row.id,
        }}
        sorting={{
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
          onSort: handleSort,
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
              className={reviewModal.action === 'approve' ? 'bg-emerald-600' : 'bg-red-600'}
            >
              {processing
                ? 'Processing...'
                : reviewModal.action === 'approve'
                ? 'Approve'
                : 'Reject'}
            </Button>
          </div>
        }
      >
        {reviewLoading && (
          <div className="py-6 text-sm text-gray-600">Loading submission…</div>
        )}
        {reviewModal.submission && !reviewLoading && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Submission Details</h4>
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <p>
                  <strong>Participant:</strong> {reviewModal.submission.user.name}
                </p>
                <p>
                  <strong>Activity:</strong> {reviewModal.submission.activity.name}
                </p>
                <p>
                  <strong>Submitted:</strong>{' '}
                  {new Date(reviewModal.submission.created_at).toLocaleDateString()}
                </p>
                {reviewModal.action === 'approve' && (
                  <p>
                    <strong>Base Points:</strong> {getBasePoints(reviewModal.submission)}
                  </p>
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
