'use client'

import React, { useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { getSubmissionByIdAction, reviewSubmissionAction } from '@/lib/actions/submissions'
import { toMsg } from '@/lib/errors'
import type { AdminSubmission } from '@elevate/types/admin-api-types'
import { Button, Textarea, Input, Alert } from '@elevate/ui'
import { StatusBadge, ConfirmModal } from '@elevate/ui/blocks'

export interface ReviewClientProps {
  initialSubmission: AdminSubmission
}

export default function ReviewClient({ initialSubmission }: ReviewClientProps) {
  const router = useRouter()
  const [submission, setSubmission] = useState<AdminSubmission>(initialSubmission)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState(initialSubmission.review_note ?? '')
  const [pointAdjustment, setPointAdjustment] = useState<number | ''>('')
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; action: 'approve' | 'reject' }>({ isOpen: false, action: 'approve' })

  const submissionId = initialSubmission.id

  const basePoints = useMemo(() => getBasePoints(initialSubmission), [initialSubmission])
  const maxAdjustment = Math.ceil(basePoints * 0.2)

  const refresh = async () => {
    try {
      setLoading(true)
      const res = await getSubmissionByIdAction(submissionId)
      setSubmission(res.submission as AdminSubmission)
      setReviewNote((res.submission as AdminSubmission).review_note ?? '')
    } catch (e: unknown) {
      setError(toMsg('Fetch submission', e))
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    setProcessing(true)
    setError(null)
    try {
      await reviewSubmissionAction({
        submissionId,
        action,
        ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}),
        ...(pointAdjustment === '' ? {} : { pointAdjustment: Number(pointAdjustment) }),
      })
      await refresh()
      setConfirmModal({ isOpen: false, action: 'approve' })
    } catch (e: unknown) {
      setError(toMsg('Process review', e))
    } finally {
      setProcessing(false)
    }
  }

  function getBasePoints(s: AdminSubmission): number {
    if (s.activity.code === 'AMPLIFY') {
      const payload = s.payload as unknown
      const peers =
        payload && typeof payload === 'object' && 'peers_trained' in payload
          ? Number((payload as Record<string, unknown>).peers_trained) || 0
          : 0
      const students =
        payload && typeof payload === 'object' && 'students_trained' in payload
          ? Number((payload as Record<string, unknown>).students_trained) || 0
          : 0
      return Math.min(Number(peers) || 0, 50) * 2 + Math.min(Number(students) || 0, 200) * 1
    }
    return s.activity.default_points || 0
  }

  function renderPayloadField(_: string, value: unknown): React.ReactNode {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') {
      return <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(value, null, 2)}</pre>
    }
    if (typeof value === 'string' && value.length > 100) {
      return <div className="text-sm"><div className="mb-2">{value}</div></div>
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-sm">{String(value)}</span>
    }
    return <span className="text-sm">-</span>
  }

  function renderAttachments() {
    const files = submission.attachments_rel || []
    if (!files || files.length === 0) return <p className="text-gray-500">No attachments</p>
    return (
      <div className="space-y-2">
        {files.map((att) => (
          <div key={att.id} className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">📎</span>
            <span className="text-sm">{att.path.split('/').pop() || att.path}</span>
            <Button variant="ghost" className="py-0.5 px-2 text-[12px]" onClick={() => window.open(`/api/files/${att.path}`, '_blank')}>View</Button>
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
          <Button variant="ghost" onClick={() => router.push('/admin/submissions')} className="mt-4">
            Back to Queue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Review Submission</h1>
          <Button variant="ghost" onClick={() => router.push('/admin/submissions')}>← Back to Queue</Button>
        </div>
        <p className="text-gray-600">Reviewing {submission.activity.name} submission by {submission.user.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Submission Details</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Status</span>
                <StatusBadge status={submission.status} />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Visibility</span>
                <StatusBadge status={submission.visibility} />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Submitted</span>
                <p className="text-sm">{new Date(submission.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Last Updated</span>
                <p className="text-sm">{submission.updated_at ? new Date(submission.updated_at).toLocaleString() : 'Never'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Submission Data</h3>
              {Object.entries(submission.payload || {}).map(([key, value]) => (
                <div key={key}>
                  <span className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  </span>
                  {renderPayloadField(key, value)}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Attachments</h2>
            {renderAttachments()}
          </div>
          {submission.review_note && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Previous Review</h2>
              <div className="bg-gray-50 p-4 rounded"><p className="text-sm">{submission.review_note}</p></div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Participant</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">{submission.user.name}</span><br /><span className="text-gray-600">@{submission.user.handle}</span></div>
              <div><span className="text-gray-600">{submission.user.email}</span></div>
              {submission.user.school && (<div><span className="text-gray-600">{submission.user.school}</span></div>)}
              {submission.user.cohort && (<div><span className="text-gray-600">Cohort: {submission.user.cohort}</span></div>)}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Points</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Base</span><span>{basePoints}</span></div>
              <div className="flex justify-between"><span>Max Adj</span><span>±{maxAdjustment}</span></div>
              <div className="flex justify-between"><span>Total Attachments</span><span>{submission.attachmentCount ?? submission.attachments_rel?.length ?? 0}</span></div>
              <div className="flex justify-between"><span>Activity</span><span>{submission.activity.name}</span></div>
            </div>
          </div>
          {submission.status === 'PENDING' && (
            <div className="bg-white border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Review Actions</h3>
              <div>
                <label htmlFor="point-adjustment" className="block text-sm font-medium text-gray-700 mb-1">Point Adjustment (Optional)</label>
                <Input id="point-adjustment" type="number" placeholder={`Base: ${basePoints}`} value={pointAdjustment} onChange={(e) => setPointAdjustment(e.target.value === '' ? '' : Number(e.target.value))} />
                <p className="text-xs text-gray-500 mt-1">Max ±{maxAdjustment} points (20% of base)</p>
              </div>
              <div>
                <label htmlFor="review-notes" className="block text-sm font-medium text-gray-700 mb-1">Review Notes</label>
                <Textarea id="review-notes" placeholder="Add feedback for the participant..." rows={4} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Button variant="default" className="w-full bg-emerald-600" onClick={() => setConfirmModal({ isOpen: true, action: 'approve' })} disabled={processing}>Approve Submission</Button>
                <Button variant="default" className="w-full bg-red-600" onClick={() => setConfirmModal({ isOpen: true, action: 'reject' })} disabled={processing}>Reject Submission</Button>
              </div>
            </div>
          )}
          {submission.status !== 'PENDING' && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Review Status</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">Status: </span><StatusBadge status={submission.status} size="sm" /></div>
                {submission.reviewer && (<div><span className="text-gray-600">Reviewed by: </span><span>{submission.reviewer.id}</span></div>)}
                {submission.review_note && (<div><span className="text-gray-600">Note: </span><span>{submission.review_note}</span></div>)}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: 'approve' })}
        onConfirm={() => void handleReview(confirmModal.action)}
        title={`${confirmModal.action === 'approve' ? 'Approve' : 'Reject'} Submission`}
        message={`Are you sure you want to ${confirmModal.action} this submission?`}
        confirmText={confirmModal.action === 'approve' ? 'Approve' : 'Reject'}
        isLoading={processing}
      />
    </div>
  )
}
