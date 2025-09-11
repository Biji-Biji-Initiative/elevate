"use server"
import 'server-only'

import { toAdminSubmission, type SubmissionRow } from '@/lib/server/mappers'
import { requireRole } from '@elevate/auth/server-helpers'
import { findSubmissionById, findSubmissionsWithFilters, countSubmissionsWithFilters, prisma } from '@elevate/db'
// SLO metrics are recorded via recordSLO helper
import { recordSLO } from '@/lib/server/obs'
import {
  parseSubmissionStatus,
  parseActivityCode,
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  SUBMISSION_STATUSES,
  LEDGER_SOURCES,
} from '@elevate/types'
import type { AdminSubmission, Pagination } from '@elevate/types/admin-api-types'
import type { SubmissionWhereClause } from '@elevate/types/common'
import { AdminError } from '@/lib/server/admin-error'

 

export type ListParams = {
  status?: string
  activity?: string
  userId?: string
  page: number
  limit: number
  sortBy: 'created_at' | 'updated_at' | 'status'
  sortOrder: 'asc' | 'desc'
}

export async function listSubmissionsService(params: ListParams): Promise<{ submissions: AdminSubmission[]; pagination: Pagination }> {
  await requireRole('reviewer')
  const start = Date.now()
  const { status, activity, userId, page, limit, sortBy, sortOrder } = params
  const offset = (page - 1) * limit
  const where: SubmissionWhereClause = {}

  if (status && status !== 'ALL') {
    const s = parseSubmissionStatus(status)
    if (s) where.status = s
  }
  if (activity && activity !== 'ALL') {
    const a = parseActivityCode(activity)
    if (a) where.activity_code = a
  }
  if (userId) where.user_id = userId

  const [submissions, total] = await Promise.all([
    findSubmissionsWithFilters({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, handle: true, school: true, cohort: true } },
        activity: true,
        attachments_rel: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit,
    }),
    countSubmissionsWithFilters(where),
  ])

  const mapped: AdminSubmission[] = (submissions as SubmissionRow[]).map((s) => toAdminSubmission(s))

  recordSLO('/admin/service/submissions/list', start, 200)
  return {
    submissions: mapped,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function getSubmissionByIdService(id: string): Promise<{ submission: AdminSubmission }> {
  await requireRole('reviewer')
  const start = Date.now()
  const s = await findSubmissionById(id)
  if (!s) throw new AdminError('NOT_FOUND', 'Submission not found')

  const sRow = s as SubmissionRow
  const submission = toAdminSubmission(sRow)
  recordSLO('/admin/service/submissions/get', start, 200)
  return { submission }
}

export async function reviewSubmissionService(body: unknown) {
  const reviewer = await requireRole('reviewer')
  const start = Date.now()
  const parsed = ReviewSubmissionSchema.parse(body)
  const { submissionId, action, reviewNote, pointAdjustment } = parsed

  const submission = await findSubmissionById(submissionId)
  if (!submission) throw new AdminError('NOT_FOUND', 'Submission not found')
  if (submission.status !== SUBMISSION_STATUSES[0]) throw new AdminError('CONFLICT', 'Submission already reviewed')
  const newStatus = action === 'approve' ? SUBMISSION_STATUSES[1] : SUBMISSION_STATUSES[2]

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: { status: newStatus, reviewer_id: reviewer.userId, review_note: reviewNote || null, updated_at: new Date() },
    })
    if (newStatus === SUBMISSION_STATUSES[1]) {
      const delta = typeof pointAdjustment === 'number' ? pointAdjustment : 0
      await tx.pointsLedger.create({
        data: {
          user_id: submission.user_id,
          activity_code: submission.activity_code,
          source: LEDGER_SOURCES[0],
          delta_points: submission.activity.default_points + delta,
          event_time: new Date(),
          meta: {},
        },
      })
    }
    await tx.auditLog.create({
      data: {
        actor_id: reviewer.userId,
        action: 'REVIEW_SUBMISSION',
        target_id: submissionId,
        meta: {},
      },
    })
  })
  const logger = await (await import('@elevate/logging/safe-server')).getSafeServerLogger('admin-submissions')
  logger.info('Reviewed submission', { submissionId, action })
  recordSLO('/admin/service/submissions/review', start, 200)
  return { message: 'Review processed' }
}

export async function bulkReviewService(body: unknown) {
  await requireRole('reviewer')
  const start = Date.now()
  const parsed = BulkReviewSubmissionsSchema.parse(body)
  const { submissionIds, action, reviewNote } = parsed

  let processed = 0
  const errors: Array<{ submissionId: string; error: string }> = []
  for (const id of submissionIds) {
    try {
      await reviewSubmissionService({ submissionId: id, action, reviewNote })
      processed += 1
    } catch (e) {
      errors.push({ submissionId: id, error: e instanceof Error ? e.message : String(e) })
    }
  }
  const logger = await (await import('@elevate/logging/safe-server')).getSafeServerLogger('admin-submissions')
  logger.info('Bulk review', { action, processed, failed: submissionIds.length - processed })
  recordSLO('/admin/service/submissions/bulk-review', start, 200)
  return { processed, failed: submissionIds.length - processed, errors }
}
