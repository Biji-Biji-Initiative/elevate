import type { NextRequest } from 'next/server'

import { z } from 'zod'

import { requireRole } from '@elevate/auth/server-helpers'
// Use database service layer instead of direct Prisma
import {
  findSubmissionById,
  findSubmissionsWithFilters,
  countSubmissionsWithFilters,
  prisma, // Still need for transactions and raw queries
  type Prisma,
} from '@elevate/db'
import {
  createSuccessResponse,
  withApiErrorHandling,
  type ApiContext,
} from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import {
  recordApiAvailability,
  recordApiResponseTime,
} from '@elevate/logging/slo-monitor'
import { computePoints } from '@elevate/logic'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import {
  parseSubmissionStatus,
  parseActivityCode,
  parseSubmissionPayload,
  buildAuditMeta,
  ReviewSubmissionSchema,
  BulkReviewSubmissionsSchema,
  AdminSubmissionsQuerySchema,
  ValidationError,
  NotFoundError,
  ElevateApiError,
  SUBMISSION_STATUSES,
  LEDGER_SOURCES,
} from '@elevate/types'
import type { SubmissionWhereClause } from '@elevate/types/common'
// (kept for readability)

export const runtime = 'nodejs'

export const GET = withApiErrorHandling(
  async (request: NextRequest, context: ApiContext) => {
    return withRateLimit(request, adminRateLimiter, async () => {
    const start = Date.now()
    const logger = await getSafeServerLogger('admin-submissions')
    await requireRole('reviewer')
    const { searchParams } = new URL(request.url)

    const parsedQuery = AdminSubmissionsQuerySchema.safeParse(
      Object.fromEntries(searchParams),
    )
    if (!parsedQuery.success) {
      throw new ValidationError(
        parsedQuery.error,
        'Invalid query parameters',
        context.traceId,
      )
    }
    const { status, activity, userId, page, limit, sortBy, sortOrder } =
      parsedQuery.data

    const offset = (page - 1) * limit

    const where: SubmissionWhereClause = {}

    if (status && status !== 'ALL') {
      const parsedStatus = parseSubmissionStatus(status)
      if (parsedStatus) {
        where.status = parsedStatus
      }
    }

    if (activity && activity !== 'ALL') {
      const parsedActivity = parseActivityCode(activity)
      if (parsedActivity) {
        where.activity_code = parsedActivity
      }
    }

    if (userId) {
      where.user_id = userId
    }

    const [submissions, total] = await Promise.all([
      findSubmissionsWithFilters({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              handle: true,
              school: true,
              cohort: true,
            },
          },
          activity: true,
          attachments_rel: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: offset,
        take: limit,
      }),
      countSubmissionsWithFilters(where),
    ])

    // Map to include attachmentCount sourced from relation without any-casts
    const mapped = submissions.map((s) => {
      const rel = (s as Record<string, unknown>)['attachments_rel']
      const attachmentCount = Array.isArray(rel) ? rel.length : 0
      return { ...(s as object), attachmentCount }
    })
    logger.info('Fetched submissions', { count: mapped.length, total })
    const res = createSuccessResponse({
      submissions: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
    recordApiAvailability('/api/admin/submissions', 'GET', 200)
    recordApiResponseTime(
      '/api/admin/submissions',
      'GET',
      Date.now() - start,
      200,
    )
    return res
    })
  },
)

export const PATCH = withApiErrorHandling(
  async (request: NextRequest, context: ApiContext) => {
    return withRateLimit(request, adminRateLimiter, async () => {
    const logger = await getSafeServerLogger('admin-submissions')
    const user = await requireRole('reviewer')
    const body = await request.json()
    const parsed = ReviewSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error,
        'Invalid request body',
        context.traceId,
      )
    }
    const { submissionId, action, reviewNote, pointAdjustment } = parsed.data

    if (!submissionId || !action) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'submissionId and action are required',
            path: ['submissionId', 'action'],
          },
        ]),
        'Missing required fields',
        context.traceId,
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'action must be approve or reject',
            path: ['action'],
          },
        ]),
        'Invalid action',
        context.traceId,
      )
    }

    const submission = await findSubmissionById(submissionId)

    if (!submission) {
      throw new NotFoundError('Submission', submissionId, context.traceId)
    }

    if (submission.status !== SUBMISSION_STATUSES[0]) {
      // PENDING
      throw new ElevateApiError(
        'Submission has already been reviewed',
        'INVALID_SUBMISSION_STATUS',
        { currentStatus: submission.status },
        context.traceId,
      )
    }

    const newStatus =
      action === 'approve' ? SUBMISSION_STATUSES[1] : SUBMISSION_STATUSES[2] // APPROVED : REJECTED

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update submission
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: newStatus,
          reviewer_id: user.userId,
          review_note: reviewNote || null,
          updated_at: new Date(),
        },
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          actor_id: user.userId,
          action:
            action === 'approve' ? 'APPROVE_SUBMISSION' : 'REJECT_SUBMISSION',
          target_id: submissionId,
          meta: buildAuditMeta(
            { entityType: 'submission', entityId: submissionId },
            {
              reviewNote,
              pointAdjustment,
              submissionType: submission.activity_code,
            },
          ) as Prisma.InputJsonValue,
        },
      })

      // Award points if approved (skip LEARN — points flow via Kajabi tags/webhook)
      if (action === 'approve' && submission.activity_code !== 'LEARN') {
        const activityCode = parseActivityCode(submission.activity_code)
        const payload = parseSubmissionPayload(submission.payload)

        if (!activityCode || !payload) {
          throw new Error(
            'Invalid submission data - cannot parse activity code or payload',
          )
        }

        const basePoints = computePoints(activityCode, payload.data)
        const finalPoints =
          pointAdjustment !== undefined ? pointAdjustment : basePoints

        // Validate point adjustment is within bounds (±20% of base points)
        if (pointAdjustment !== undefined) {
          const maxAdjustment = Math.ceil(basePoints * 0.2)
          if (Math.abs(pointAdjustment - basePoints) > maxAdjustment) {
            throw new ElevateApiError(
              `Point adjustment must be within ±${maxAdjustment} of base points (${basePoints})`,
              'POINT_ADJUSTMENT_OUT_OF_BOUNDS',
              { basePoints, pointAdjustment, maxAdjustment },
              context.traceId,
            )
          }
        }

        await tx.pointsLedger.create({
          data: {
            user_id: submission.user_id,
            activity_code: submission.activity_code,
            source: LEDGER_SOURCES[0], // MANUAL
            delta_points: finalPoints,
            event_time: new Date(),
            external_source: 'admin_approval',
            external_event_id: `submission_${submissionId}`,
          },
        })

        // Log point adjustment if different from base
        if (pointAdjustment !== undefined && pointAdjustment !== basePoints) {
          await tx.auditLog.create({
            data: {
              actor_id: user.userId,
              action: 'ADJUST_POINTS',
              target_id: submissionId,
              meta: buildAuditMeta(
                { entityType: 'submission', entityId: submissionId },
                {
                  basePoints,
                  adjustedPoints: pointAdjustment,
                  reason: reviewNote,
                },
              ) as Prisma.InputJsonValue,
            },
          })
        }
      }

      return updatedSubmission
    })
    logger.info('Reviewed submission', {
      submissionId,
      action,
      reviewerId: user.userId,
    })

    // Note: Materialized views are not used in the Prisma ORM implementation
    // The leaderboard API now calculates data in real-time using proper Prisma aggregations
    // This provides better consistency and eliminates the need for manual view refreshes

    return createSuccessResponse({
      submission: result,
      message: `Submission ${action}d successfully`,
    })
    })
  },
)

// Bulk operations
export const POST = withApiErrorHandling(
  async (request: NextRequest, context: ApiContext) => {
    return withRateLimit(request, adminRateLimiter, async () => {
    const start = Date.now()
    const logger = await getSafeServerLogger('admin-submissions')
    const user = await requireRole('reviewer')
    const body = await request.json()
    const parsed = BulkReviewSubmissionsSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error,
        'Invalid request body',
        context.traceId,
      )
    }
    const { submissionIds, action, reviewNote } = parsed.data

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'submissionIds array is required',
            path: ['submissionIds'],
          },
        ]),
        'Missing submission IDs',
        context.traceId,
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'action must be approve or reject',
            path: ['action'],
          },
        ]),
        'Invalid action',
        context.traceId,
      )
    }

    // Limit bulk operations to prevent abuse
    if (submissionIds.length > 50) {
      throw new ElevateApiError(
        'Maximum 50 submissions per bulk operation',
        'SUBMISSION_LIMIT_EXCEEDED',
        { limit: 50, provided: submissionIds.length },
        context.traceId,
      )
    }

    const submissions = await findSubmissionsWithFilters({
      where: {
        id: { in: submissionIds },
        status: SUBMISSION_STATUSES[0], // PENDING
      },
      include: { activity: true },
    })

    if (submissions.length === 0) {
      throw new NotFoundError('Pending submissions', undefined, context.traceId)
    }

    const newStatus =
      action === 'approve' ? SUBMISSION_STATUSES[1] : SUBMISSION_STATUSES[2] // APPROVED : REJECTED
    const results = []

    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (const submission of submissions) {
        // Update submission
        const updated = await tx.submission.update({
          where: { id: submission.id },
          data: {
            status: newStatus,
            reviewer_id: user.userId,
            review_note: reviewNote || null,
            updated_at: new Date(),
          },
        })

        // Create audit log
        await tx.auditLog.create({
          data: {
            actor_id: user.userId,
            action:
              action === 'approve' ? 'APPROVE_SUBMISSION' : 'REJECT_SUBMISSION',
            target_id: submission.id,
            meta: buildAuditMeta(
              { entityType: 'submission', entityId: submission.id },
              {
                reviewNote,
                submissionType: submission.activity_code,
                bulkOperation: true,
              },
            ) as Prisma.InputJsonValue,
          },
        })

        // Award points if approved (skip LEARN — points flow via Kajabi tags/webhook)
        if (action === 'approve' && submission.activity_code !== 'LEARN') {
          const activityCode = parseActivityCode(submission.activity_code)
          const payload = parseSubmissionPayload(submission.payload)

          if (!activityCode || !payload) {
            throw new Error(
              `Invalid submission data for submission ${submission.id}`,
            )
          }

          const points = computePoints(activityCode, payload.data)

          await tx.pointsLedger.create({
            data: {
              user_id: submission.user_id,
              activity_code: submission.activity_code,
              source: LEDGER_SOURCES[0], // MANUAL
              delta_points: points,
              event_time: new Date(),
              external_source: 'admin_approval',
              external_event_id: `submission_${submission.id}`,
            },
          })
        }

        results.push(updated)
      }
    })
    logger.info('Bulk reviewed submissions', {
      processed: results.length,
      action,
      reviewerId: user.userId,
    })

    // Note: Materialized views are not used in the Prisma ORM implementation
    // The leaderboard API now calculates data in real-time using proper Prisma aggregations
    // This provides better consistency and eliminates the need for manual view refreshes

    const res = createSuccessResponse({
      processed: results.length,
      message: `${results.length} submissions ${action}d successfully`,
    })
    recordApiAvailability('/api/admin/submissions', 'POST', 200)
    recordApiResponseTime(
      '/api/admin/submissions',
      'POST',
      Date.now() - start,
      200,
    )
    return res
    })
  },
)
