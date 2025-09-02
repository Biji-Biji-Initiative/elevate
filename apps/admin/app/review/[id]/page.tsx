'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@elevate/ui/Button'
import { Textarea } from '@elevate/ui/Textarea'
import { Input } from '@elevate/ui/Input'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { ConfirmModal } from '../../../components/ui/Modal'

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
    default_points: number
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

export default function ReviewSubmissionPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [pointAdjustment, setPointAdjustment] = useState<number | ''>('')
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    action: 'approve' | 'reject'
  }>({
    isOpen: false,
    action: 'approve'
  })

  const [submissionId, setSubmissionId] = useState<string | null>(null)

  useEffect(() => {
    const getParams = async () => {
      const { id } = await params
      setSubmissionId(id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (submissionId) {
      fetchSubmission()
    }
  }, [submissionId])

  const fetchSubmission = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}`)
      const data = await response.json()
      
      if (response.ok) {
        setSubmission(data.submission)
        setReviewNote(data.submission.review_note || '')
      } else {
        console.error('Failed to fetch submission:', data.error)
        router.push('/admin/submissions')
      }
    } catch (error) {
      console.error('Error fetching submission:', error)
      router.push('/admin/submissions')
    } finally {
      setLoading(false)
    }
  }

  const getBasePoints = (): number => {
    if (!submission) return 0
    
    if (submission.activity.code === 'AMPLIFY') {
      const peers = Number(submission.payload?.peersTrained || 0)
      const students = Number(submission.payload?.studentsTrained || 0)
      return Math.min(peers, 50) * 2 + Math.min(students, 200) * 1
    }

    return submission.activity.default_points
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!submission) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          reviewNote: reviewNote || undefined,
          pointAdjustment: pointAdjustment !== '' ? Number(pointAdjustment) : undefined
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        // Refresh submission data
        await fetchSubmission()
        setConfirmModal({ isOpen: false, action: 'approve' })
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

  const renderPayloadField = (key: string, value: any): React.ReactNode => {
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
    
    return <span className="text-sm">{String(value)}</span>
  }

  const renderAttachments = () => {
    if (!submission?.attachments || submission.attachments.length === 0) {
      return <p className="text-gray-500">No attachments</p>
    }

    return (
      <div className="space-y-2">
        {submission.attachments.map((attachment, index) => (
          <div key={index} className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">📎</span>
            <span className="text-sm">{attachment.split('/').pop() || attachment}</span>
            <Button
              variant="ghost"
              style={{ padding: '2px 8px', fontSize: '12px' }}
              onClick={() => {
                // In a real implementation, you'd generate a signed URL
                window.open(`/api/files/${attachment}`, '_blank')
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
                <p className="text-sm">{new Date(submission.updated_at).toLocaleString()}</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Point Adjustment (Optional)
                </label>
                <Input
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Notes
                </label>
                <Textarea
                  placeholder="Add feedback for the participant..."
                  rows={4}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Button
                  variant="primary"
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
                  variant="primary"
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

