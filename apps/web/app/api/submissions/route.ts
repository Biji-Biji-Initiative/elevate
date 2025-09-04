import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

// Use database service layer instead of direct Prisma
import { 
  findUserById,
  findActivityByCode,
  findSubmissionsByUserId,
  findSubmissionsByUserAndActivity,
  countSubmissionsByUserAndActivity,
  findSubmissionsWithPagination,
  createSubmission,
  createSubmissionAttachment,
  type SubmissionWithRelations,
  type Submission,
  type Activity
} from '@elevate/db'

// Import DTO transformers

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
import { SubmissionCreateRequestSchema } from '@elevate/types'
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
  ACTIVITY_CODES,
  LEARN,
  AMPLIFY,
  VISIBILITY_OPTIONS,
  SUBMISSION_STATUSES
} from '@elevate/types'
import {
  transformPayloadAPIToDB,
  transformPayloadDBToAPI,
  type SubmissionDTO
} from '@elevate/types/dto-mappers'

// Local wrapper to ensure type safety for object inputs to Prisma JSON fields
function toPrismaJsonObject(obj: object): Exclude<ReturnType<typeof toPrismaJson>, null> {
  const result = toPrismaJson(obj);
  if (result === null) {
    throw new Error('Unexpected null result from non-null object');
  }
  return result;
}

export const runtime = 'nodejs';

// Use shared request schema from @elevate/types
const SubmissionRequestSchema = SubmissionCreateRequestSchema

export const POST = withCSRFProtection(withApiErrorHandling(async (request: NextRequest, context) => {
  // Apply rate limiting for submissions
  return withRateLimit(request, submissionRateLimiter, async () => {
    const { userId } = await auth()
  
  if (!userId) {
    throw new AuthenticationError()
  }

  // Verify user exists in database
  const user = await findUserById(userId)

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

  // Sanitize client payload (camelCase) then transform to DB shape (snake_case)
  const sanitizedApiPayload = sanitizeSubmissionPayload(
    validatedData.activityCode,
    validatedData.payload as Record<string, unknown>
  )

  // Transform payload from API format (camelCase) to DB format (snake_case)
  const dbPayload = transformPayloadAPIToDB(validatedData.activityCode, sanitizedApiPayload)

  // Validate the DB payload against canonical schemas for the selected activity
  const dbPayloadValidation = parseSubmissionPayload({
    activityCode: validatedData.activityCode,
    data: dbPayload,
  })
  if (!dbPayloadValidation) {
    throw new ValidationError(
      new z.ZodError([{ code: 'custom', message: 'Invalid payload structure', path: ['payload'] }]),
      'Invalid payload for selected activity',
      context.traceId
    )
  }

  // Verify activity exists
  const activity = await findActivityByCode(validatedData.activityCode)

  if (!activity) {
    throw new NotFoundError('Activity', validatedData.activityCode, context.traceId)
  }

  // Check for existing pending/approved submissions for certain activities
  if ([LEARN].includes(validatedData.activityCode)) {
    const existingSubmissions = await findSubmissionsByUserAndActivity(
      userId,
      validatedData.activityCode,
      [SUBMISSION_STATUSES[0], SUBMISSION_STATUSES[1]]
    )

    if (existingSubmissions.length > 0) {
      const existingSubmission = existingSubmissions[0]
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
    if (validatedData.activityCode === AMPLIFY) {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const recentSubmissions = await countSubmissionsByUserAndActivity(
        userId,
        AMPLIFY,
        { gte: sevenDaysAgo }
      )

      // Calculate total peers and students trained in last 7 days
      const totalPeers = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: AMPLIFY, data: sub.payload })
        return sum + (parsedPayload?.data.peersTrained || 0)
      }, 0)

      const totalStudents = recentSubmissions.reduce((sum: number, sub: Submission) => {
        const parsedPayload = parseAmplifyPayload({ activityCode: AMPLIFY, data: sub.payload })
        return sum + (parsedPayload?.data.studentsTrained || 0)
      }, 0)

    // Parse the new submission payload
    const newPayload = parseAmplifyPayload({ activityCode: AMPLIFY, data: validatedData.payload })
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
    const submission = await createSubmission({
      user_id: userId,
      activity_code: validatedData.activityCode,
      payload: dbPayload,
      visibility: validatedData.visibility || VISIBILITY_OPTIONS[0] // PRIVATE
    })

    // Persist attachments as relational rows
    if (Array.isArray(validatedData.attachments) && validatedData.attachments.length > 0) {
      const validAttachments = validatedData.attachments
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
      
      for (const path of validAttachments) {
        try {
          await createSubmissionAttachment({
            submission_id: submission.id,
            filename: path.split('/').pop() || path,
            path: path,
            mime_type: 'application/octet-stream', // Default, should be determined from file
            size_bytes: 0 // Would need to be determined from actual file
          })
        } catch (error) {
          // Skip duplicates silently
          console.warn(`Failed to create attachment ${path}:`, error)
        }
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

    const { submissions, totalCount } = await findSubmissionsWithPagination(
      whereClause,
      limit,
      offset
    )

  return createSuccessResponse({
    data: submissions.map((submission) => ({
      id: submission.id,
      activityCode: submission.activity_code,
      activityName: submission.activity.name,
      status: submission.status,
      visibility: submission.visibility,
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
      reviewNote: submission.review_note,
      attachmentCount: submission.attachments_rel.length,
      // Transform payload from DB format (snake_case) to API format (camelCase)
      payload: transformPayloadDBToAPI(submission.activity_code, submission.payload)
    })),
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    }
  })
})
