import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@elevate/db/client'
import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { computePoints } from '@elevate/logic'
import type { SubmissionWhereClause, ActivityCode, ActivityPayload } from '@elevate/types'
import type { SubmissionStatus } from '@elevate/db'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('reviewer')
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') || 'PENDING'
    const activity = searchParams.get('activity')
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    const offset = (page - 1) * limit
    
    const where: SubmissionWhereClause = {}
    
    if (status && status !== 'ALL') {
      where.status = status as SubmissionStatus
    }
    
    if (activity) {
      where.activity_code = activity as ActivityCode
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
          activity: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: offset,
        take: limit
      }),
      prisma.submission.count({ where })
    ])
    
    return NextResponse.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return createErrorResponse(error, 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole('reviewer')
    const body = await request.json()
    const { submissionId, action, reviewNote, pointAdjustment } = body
    
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
          meta: {
            reviewNote,
            pointAdjustment,
            submissionType: submission.activity_code
          }
        }
      })
      
      // Award points if approved
      if (action === 'approve') {
        const basePoints = computePoints(submission.activity_code as ActivityCode, submission.payload as ActivityPayload)
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
              meta: {
                basePoints,
                adjustedPoints: pointAdjustment,
                reason: reviewNote
              }
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
    const { submissionIds, action, reviewNote } = body
    
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
            meta: {
              reviewNote,
              submissionType: submission.activity_code,
              bulkOperation: true
            }
          }
        })
        
        // Award points if approved
        if (action === 'approve') {
          const points = computePoints(submission.activity_code as ActivityCode, submission.payload as ActivityPayload)
          
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