import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { prisma } from '@elevate/db/client'
import { 
  parseActivityCode, 
  parseSubmissionStatus, 
  parseAmplifyPayload, 
  parseSubmissionPayload, 
  SubmissionPayloadSchema,
  toJsonValue, 
  toPrismaJson, 
  type SubmissionWhereClause,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  SubmissionLimitError,
} from '@elevate/types'
import {
  createSuccessResponse,
  createErrorResponse,
  withApiErrorHandling,
  unauthorized,
  notFound,
  badRequest,
  validationError,
  generateTraceId
} from '@elevate/http'
import { withCSRFProtection } from '@elevate/security/csrf'
import { submissionRateLimiter, withRateLimit } from '@elevate/security/rate-limiter'
import { sanitizeSubmissionPayload } from '@elevate/security/sanitizer'

// Local wrapper to ensure type safety for object inputs to Prisma JSON fields
function toPrismaJsonObject(obj: any): Exclude<ReturnType<typeof toPrismaJson>, null> {
  const result = toPrismaJson(obj);
  if (result === null) {
    throw new Error('Unexpected null result from non-null object');
  }
  return result;
}

import type { Submission, Activity } from '@prisma/client'

type SubmissionWithActivity = Submission & {
  activity: Activity
}

export const runtime = 'nodejs';

// Submission request schema
const SubmissionRequestSchema = z.object({
  activityCode: z.enum(['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']),
  payload: SubmissionPayloadSchema.transform(p => p.data),
  attachments: z.array(z.string()).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional()
})

export const POST = withCSRFProtection(withApiErrorHandling(async (request: NextRequest, context) => {
  // Apply rate limiting for submissions
  return withRateLimit(request, submissionRateLimiter, async () => {
    const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

  // Verify user exists in database
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new NotFoundError('User', userId, context.traceId)
  }

  const body: unknown = await request.json()
  let validatedData: z.infer<typeof SubmissionRequestSchema>
  
  try {
    validatedData = SubmissionRequestSchema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error, 'Invalid submission data', context.traceId)
    }
    throw error
  }

  // Sanitize and validate payload structure
  const sanitizedPayload = sanitizeSubmissionPayload(validatedData.activityCode, validatedData.payload)
  
  const payloadValidation = parseSubmissionPayload({
    activityCode: validatedData.activityCode,
    data: sanitizedPayload,
  })
  if (!payloadValidation) {
    throw new ValidationError(
      new z.ZodError([{ code: 'custom', message: 'Invalid payload structure', path: ['payload'] }]),
      'Invalid payload for selected activity',
      context.traceId
    )
  }

  // Verify activity exists
  const activity = await prisma.activity.findUnique({
    where: { code: validatedData.activityCode }
  })

  if (!activity) {
    throw new NotFoundError('Activity', validatedData.activityCode, context.traceId)
  }

  // Check for existing pending/approved submissions for certain activities
  if (['LEARN'].includes(validatedData.activityCode)) {
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        user_id: userId,
        activity_code: validatedData.activityCode,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    })

    if (existingSubmission) {
      throw new ValidationError(
        new z.ZodError([{ 
          code: 'custom', 
          message: `You already have a ${existingSubmission.status.toLowerCase()} ${validatedData.activityCode} submission`,
          path: ['activityCode'] 
        }]),
        'Duplicate submission not allowed',
        context.traceId
      )
    }
  }

    // For Amplify submissions, check 7-day rolling limits
    if (validatedData.activityCode === 'AMPLIFY') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentSubmissions = await prisma.submission.findMany({
        where: {
          user_id: userId,
          activity_code: 'AMPLIFY',
          created_at: {
            gte: sevenDaysAgo
          }
        }
      })

      // Calculate total peers and students trained in last 7 days
      const totalPeers = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: sub.payload })
        return sum + (parsedPayload?.data.peersTrained || 0)
      }, 0)

      const totalStudents = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: sub.payload })
        return sum + (parsedPayload?.data.studentsTrained || 0)
      }, 0)

    // Parse the new submission payload
    const newPayload = parseAmplifyPayload({ activityCode: 'AMPLIFY', data: validatedData.payload })
    if (!newPayload) {
      throw new ValidationError(
        new z.ZodError([{ code: 'custom', message: 'Invalid AMPLIFY payload format', path: ['payload'] }]),
        'Invalid AMPLIFY payload format',
        context.traceId
      )
    }
    
    const newPeers = newPayload.data.peersTrained || 0
    const newStudents = newPayload.data.studentsTrained || 0

    if (totalPeers + newPeers > 50) {
      throw new SubmissionLimitError(
        'Peer training',
        totalPeers + newPeers,
        50,
        context.traceId
      )
    }

    if (totalStudents + newStudents > 200) {
      throw new SubmissionLimitError(
        'Student training',
        totalStudents + newStudents,
        200,
        context.traceId
      )
    }
  }

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        user_id: userId,
        activity_code: validatedData.activityCode,
        payload: toPrismaJsonObject(sanitizedPayload),
        visibility: validatedData.visibility || 'PRIVATE'
      },
      include: {
        activity: true,
        user: {
          select: {
            name: true,
            handle: true
          }
        }
      }
    })

    // Persist attachments as relational rows (in addition to JSON for backward compatibility)
    if (Array.isArray(validatedData.attachments) && validatedData.attachments.length > 0) {
      const values = validatedData.attachments
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .map((p) => ({ submission_id: submission.id, path: p }))
      if (values.length > 0) {
        await prisma.submissionAttachment.createMany({ data: values, skipDuplicates: true })
      }
    }


  return createSuccessResponse({
    id: submission.id,
    activityCode: submission.activity_code,
    status: submission.status,
    visibility: submission.visibility,
    createdAt: submission.created_at,
    potentialPoints: activity.default_points
  }, 201)
  })
}))

export const GET = withApiErrorHandling(async (request: NextRequest, context) => {
  const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

    const url = new URL(request.url)
    const activityCode = url.searchParams.get('activity')
    const status = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0)

    const whereClause: SubmissionWhereClause = {
      user_id: userId
    }

    if (activityCode) {
      const parsedActivity = parseActivityCode(activityCode)
      if (parsedActivity) {
        whereClause.activity_code = parsedActivity
      }
    }

    if (status) {
      const parsedStatus = parseSubmissionStatus(status)
      if (parsedStatus) {
        whereClause.status = parsedStatus
      }
    }

    const [submissions, totalCount] = await Promise.all([
      prisma.submission.findMany({
        where: whereClause,
        include: {
          activity: true,
          attachments_rel: true
        },
        orderBy: {
          created_at: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.submission.count({
        where: whereClause
      })
    ])

  return createSuccessResponse({
    data: submissions.map((submission: SubmissionWithActivity) => ({
      id: submission.id,
      activityCode: submission.activity_code,
      activityName: submission.activity.name,
      status: submission.status,
      visibility: submission.visibility,
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
      reviewNote: submission.review_note,
      attachmentCount: submission.attachments_rel.length
    })),
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    }
  })
})
