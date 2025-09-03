import { type NextRequest, NextResponse } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import type { SubmissionStatus } from '@elevate/db'
import { prisma, type Prisma } from '@elevate/db'
import { computePoints } from '@elevate/logic'
// TODO: Re-enable when @elevate/security package is available
// import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { parseSubmissionStatus, parseActivityCode, parseSubmissionPayload, toPrismaJson, buildAuditMeta, ReviewSubmissionSchema, BulkReviewSubmissionsSchema, AdminSubmissionsQuerySchema, type SubmissionWhereClause, type ActivityCode, type ActivityPayload } from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // TODO: Re-enable rate limiting when @elevate/security package is available
  // return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('reviewer')
    const { searchParams } = new URL(request.url)
    
    const parsedQuery = AdminSubmissionsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsedQuery.success) {
      return createErrorResponse(new Error('Invalid query'), 400)
    }
    const { status, activity, userId, page, limit, sortBy, sortOrder } = parsedQuery.data
    
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
      prisma.submission.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              handle: true,
              school: true,
              cohort: true
            }
          },
          activity: true,
          attachments_rel: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: offset,
        take: limit
      }),
      prisma.submission.count({ where })
    ])
    
    // Map to include attachmentCount sourced from relational table (fallback to JSON array length)
    const mapped = submissions.map((s) => ({
      ...s,
      attachmentCount: Array.isArray(s.attachments_rel) && s.attachments_rel.length > 0
        ? s.attachments_rel.length
        : (Array.isArray(s.attachments) ? (s.attachments as unknown[]).length : 0),
    }))

    return NextResponse.json({
      success: true,
      data: {
        submissions: mapped,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  // TODO: Re-enable rate limiting when @elevate/security package is available
  // })
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole('reviewer')
    const body = await request.json()
    const parsed = ReviewSubmissionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { submissionId, action, reviewNote, pointAdjustment } = parsed.data
    
    if (!submissionId || !action) {
      return NextResponse.json(
        { error: 'submissionId and action are required' },
        { status: 400 }
      )
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve or reject' },
        { status: 400 }
      )
    }
    
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { activity: true }
    })
    
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }
    
    if (submission.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Submission has already been reviewed' },
        { status: 400 }
      )
    }
    
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    
    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update submission
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: newStatus,
          reviewer_id: user.userId,
          review_note: reviewNote || null,
          updated_at: new Date()
        }
      })
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          actor_id: user.userId,
          action: action === 'approve' ? 'APPROVE_SUBMISSION' : 'REJECT_SUBMISSION',
          target_id: submissionId,
          meta: buildAuditMeta({ entityType: 'submission', entityId: submissionId }, {
            reviewNote,
            pointAdjustment,
            submissionType: submission.activity_code
          }) as Prisma.InputJsonValue
        }
      })
      
      // Award points if approved
      if (action === 'approve') {
        const activityCode = parseActivityCode(submission.activity_code)
        const payload = parseSubmissionPayload(submission.payload)
        
        if (!activityCode || !payload) {
          throw new Error('Invalid submission data - cannot parse activity code or payload')
        }
        
        const basePoints = computePoints(activityCode, payload.data)
        const finalPoints = pointAdjustment !== undefined ? pointAdjustment : basePoints
        
        // Validate point adjustment is within bounds (±20% of base points)
        if (pointAdjustment !== undefined) {
          const maxAdjustment = Math.ceil(basePoints * 0.2)
          if (Math.abs(pointAdjustment - basePoints) > maxAdjustment) {
            throw new Error(`Point adjustment must be within ±${maxAdjustment} of base points (${basePoints})`)
          }
        }
        
        await tx.pointsLedger.create({
          data: {
            user_id: submission.user_id,
            activity_code: submission.activity_code,
            source: 'MANUAL',
            delta_points: finalPoints,
            external_source: 'admin_approval',
            external_event_id: `submission_${submissionId}`
          }
        })
        
        // Log point adjustment if different from base
        if (pointAdjustment !== undefined && pointAdjustment !== basePoints) {
          await tx.auditLog.create({
            data: {
              actor_id: user.userId,
              action: 'ADJUST_POINTS',
              target_id: submissionId,
              meta: buildAuditMeta({ entityType: 'submission', entityId: submissionId }, {
                basePoints,
                adjustedPoints: pointAdjustment,
                reason: reviewNote
              }) as Prisma.InputJsonValue
            }
          })
        }
      }
      
      return updatedSubmission
    })
    
    // Note: Materialized views are not used in the Prisma ORM implementation
    // The leaderboard API now calculates data in real-time using proper Prisma aggregations
    // This provides better consistency and eliminates the need for manual view refreshes
    
    return NextResponse.json({
      success: true,
      submission: result,
      message: `Submission ${action}d successfully`
    })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}

// Bulk operations
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('reviewer')
    const body = await request.json()
    const parsed = BulkReviewSubmissionsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { submissionIds, action, reviewNote } = parsed.data
    
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { error: 'submissionIds array is required' },
        { status: 400 }
      )
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve or reject' },
        { status: 400 }
      )
    }
    
    // Limit bulk operations to prevent abuse
    if (submissionIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 submissions per bulk operation' },
        { status: 400 }
      )
    }
    
    const submissions = await prisma.submission.findMany({
      where: {
        id: { in: submissionIds },
        status: 'PENDING'
      },
      include: { activity: true }
    })
    
    if (submissions.length === 0) {
      return NextResponse.json(
        { error: 'No pending submissions found' },
        { status: 404 }
      )
    }
    
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
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
            updated_at: new Date()
          }
        })
        
        // Create audit log
        await tx.auditLog.create({
          data: {
            actor_id: user.userId,
            action: action === 'approve' ? 'APPROVE_SUBMISSION' : 'REJECT_SUBMISSION',
            target_id: submission.id,
            meta: buildAuditMeta({ entityType: 'submission', entityId: submission.id }, {
              reviewNote,
              submissionType: submission.activity_code,
              bulkOperation: true
            }) as Prisma.InputJsonValue
          }
        })
        
        // Award points if approved
        if (action === 'approve') {
          const activityCode = parseActivityCode(submission.activity_code)
          const payload = parseSubmissionPayload(submission.payload)
          
          if (!activityCode || !payload) {
            throw new Error(`Invalid submission data for submission ${submission.id}`)
          }
          
          const points = computePoints(activityCode, payload.data)
          
          await tx.pointsLedger.create({
            data: {
              user_id: submission.user_id,
              activity_code: submission.activity_code,
              source: 'MANUAL',
              delta_points: points,
              external_source: 'admin_approval',
              external_event_id: `submission_${submission.id}`
            }
          })
        }
        
        results.push(updated)
      }
    })
    
    // Note: Materialized views are not used in the Prisma ORM implementation
    // The leaderboard API now calculates data in real-time using proper Prisma aggregations
    // This provides better consistency and eliminates the need for manual view refreshes
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      message: `${results.length} submissions ${action}d successfully`
    })
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}
