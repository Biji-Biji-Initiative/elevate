'use client'

import React, { useState, useEffect, useCallback } from 'react'

import { useRouter } from 'next/navigation'

import { adminClient, AdminClientError, type AdminSubmission } from '@/lib/admin-client'
import { handleApiError } from '@/lib/error-utils'
import { withRoleGuard } from '@elevate/auth/context'
import { Button , Textarea, Input, Alert } from '@elevate/ui'
import { StatusBadge, ConfirmModal } from '@elevate/ui/blocks'

function ReviewSubmissionPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [submission, setSubmission] = useState<AdminSubmission | null>(null)
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [pointAdjustment, setPointAdjustment] = useState<number | ''>('')
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    action: 'approve' | 'reject'
  }>({
    isOpen: false,
    action: 'approve'
  })

  const submissionId = params.id

  const fetchSubmission = useCallback(async () => {
    if (!submissionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await adminClient.getSubmissionById(submissionId)
      setSubmission(data.submission)
      setEvidenceUrl(data.evidence || null)
      setReviewNote(data.submission.review_note || '')
    } catch (error: unknown) {
      setError(handleApiError(error, 'Fetch submission'))
      // Don't automatically redirect on error, let user decide
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => {
    if (submissionId) {
      void fetchSubmission()
    }
  }, [submissionId, fetchSubmission])

  const getBasePoints = (): number => {
    if (!submission) return 0
    
    if (submission.activity.code === 'AMPLIFY') {
      // Type guard for AMPLIFY payload
      const isAmplifyPayload = (payload: unknown): payload is { peers_trained: number; students_trained: number } => {
        if (typeof payload !== 'object' || payload === null) return false
        const obj = payload as { peers_trained?: unknown; students_trained?: unknown }
        return typeof obj.peers_trained === 'number' && typeof obj.students_trained === 'number'
      }
      
      const amplifyPayload = isAmplifyPayload(submission.payload) ? submission.payload : { peers_trained: 0, students_trained: 0 }
      return Math.min(amplifyPayload.peers_trained, 50) * 2 + Math.min(amplifyPayload.students_trained, 200) * 1
    }

    return submission.activity.default_points || 0
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!submission || !submissionId) return

    setProcessing(true)
    setError(null)
    
    try {
      const reviewData: Parameters<typeof adminClient.reviewSubmission>[0] = {
        submissionId,
        action,
      }
      if (reviewNote.trim()) reviewData.reviewNote = reviewNote.trim()
      if (pointAdjustment !== '') reviewData.pointAdjustment = Number(pointAdjustment)
      
      await adminClient.reviewSubmission(reviewData)
      await fetchSubmission()
      setConfirmModal({ isOpen: false, action: 'approve' })
    } catch (error: unknown) {
      setError(handleApiError(error, 'Process review'))
    } finally {
      setProcessing(false)
    }
  }

  const renderPayloadField = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return '-'
    
    if (typeof value === 'object') {
      return (
        <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )
    }
    
    if (typeof value === 'string' && value.length > 100) {
      return (
        <div className="text-sm">
          <div className="mb-2">{value}</div>
        </div>
      )
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-sm">{String(value)}</span>
    }
    return <span className="text-sm">-</span>
  }

  const renderAttachments = () => {
    const files = submission?.attachments_rel || []
    if (!files || files.length === 0) {
      return <p className="text-gray-500">No attachments</p>
    }

    return (
      <div className="space-y-2">
        {files.map((att) => (
          <div key={att.id} className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">📎</span>
            <span className="text-sm">{att.path.split('/').pop() || att.path}</span>
            <Button
              variant="ghost"
              style={{ padding: '2px 8px', fontSize: '12px' }}
              onClick={() => {
                window.open(`/api/files/${att.path}`, '_blank')
              }}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}
        <div className="text-center py-12">
          <p className="text-gray-500">Submission not found</p>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/admin/submissions')}
            style={{ marginTop: '16px' }}
          >
            Back to Queue
          </Button>
        </div>
      </div>
    )
  }

  const basePoints = getBasePoints()
  const maxAdjustment = Math.ceil(basePoints * 0.2)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Review Submission</h1>
          <Button
            variant="ghost"
            onClick={() => router.push('/admin/submissions')}
          >
            ← Back to Queue
          </Button>
        </div>
        <p className="text-gray-600">
          Reviewing {submission.activity.name} submission by {submission.user.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submission Details */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Submission Details</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <StatusBadge status={submission.status} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                <StatusBadge status={submission.visibility} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submitted</label>
                <p className="text-sm">{new Date(submission.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="text-sm">{submission.updated_at ? new Date(submission.updated_at).toLocaleString() : 'Never'}</p>
              </div>
            </div>

            {/* Payload Fields */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Submission Data</h3>
              {Object.entries(submission.payload || {}).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  {renderPayloadField(key, value)}
                </div>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Attachments</h2>
            {renderAttachments()}
          </div>

          {/* Existing Review */}
          {submission.review_note && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Previous Review</h2>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm">{submission.review_note}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participant Info */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Participant</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">{submission.user.name}</span>
                <br />
                <span className="text-gray-600">@{submission.user.handle}</span>
              </div>
              <div>
                <span className="text-gray-600">{submission.user.email}</span>
              </div>
              {submission.user.school && (
                <div>
                  <span className="text-gray-600">{submission.user.school}</span>
                </div>
              )}
              {submission.user.cohort && (
                <div>
                  <span className="text-gray-600">Cohort: {submission.user.cohort}</span>
                </div>
              )}
            </div>
          </div>

          {/* Points Info */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Points</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Base Points:</span>
                <span className="font-medium">{basePoints}</span>
              </div>
              <div className="text-xs text-gray-500">
                Activity: {submission.activity.name}
              </div>
            </div>
          </div>

          {/* Review Actions */}
          {submission.status === 'PENDING' && (
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Review Actions</h3>
              
              <div>
                <label htmlFor="point-adjustment" className="block text-sm font-medium text-gray-700 mb-1">
                  Point Adjustment (Optional)
                </label>
                <Input
                  id="point-adjustment"
                  type="number"
                  placeholder={`Base: ${basePoints}`}
                  value={pointAdjustment}
                  onChange={(e) => setPointAdjustment(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max ±{maxAdjustment} points ({Math.round(20)}% of base)
                </p>
              </div>

              <div>
                <label htmlFor="review-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes
                </label>
                <Textarea
                  id="review-notes"
                  placeholder="Add feedback for the participant..."
                  rows={4}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Button
                  variant="default"
                  style={{ 
                    width: '100%',
                    backgroundColor: '#16a34a'
                  }}
                  onClick={() => setConfirmModal({ isOpen: true, action: 'approve' })}
                  disabled={processing}
                >
                  Approve Submission
                </Button>
                <Button
                  variant="default"
                  style={{ 
                    width: '100%',
                    backgroundColor: '#dc2626'
                  }}
                  onClick={() => setConfirmModal({ isOpen: true, action: 'reject' })}
                  disabled={processing}
                >
                  Reject Submission
                </Button>
              </div>
            </div>
          )}

          {/* Status Info */}
          {submission.status !== 'PENDING' && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Review Status</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Status: </span>
                  <StatusBadge status={submission.status} size="sm" />
                </div>
                {submission.reviewer_id && (
                  <div>
                    <span className="text-gray-600">Reviewed by: </span>
                    <span>{submission.reviewer_id}</span>
                  </div>
                )}
                {submission.review_note && (
                  <div>
                    <span className="text-gray-600">Note: </span>
                    <span>{submission.review_note}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: 'approve' })}
        onConfirm={() => handleReview(confirmModal.action)}
        title={`${confirmModal.action === 'approve' ? 'Approve' : 'Reject'} Submission`}
        message={`Are you sure you want to ${confirmModal.action} this submission?`}
        confirmText={confirmModal.action === 'approve' ? 'Approve' : 'Reject'}
        isLoading={processing}
      />
    </div>
  )
}

export default withRoleGuard(ReviewSubmissionPage, ['reviewer', 'admin', 'superadmin'])
