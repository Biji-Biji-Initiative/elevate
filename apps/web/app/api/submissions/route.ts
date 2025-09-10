import type { NextRequest } from 'next/server'

import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import {
  findUserById,
  findActivityByCode,
  findSubmissionsByUserAndActivity,
  findSubmissionsWithFilters,
  findSubmissionsWithPagination,
  createSubmission,
  createSubmissionAttachment,
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
import { withCSRFProtection } from '@elevate/security/csrf'
import {
  submissionRateLimiter,
  withRateLimit,
} from '@elevate/security/rate-limiter'
import { sanitizeSubmissionPayload } from '@elevate/security/sanitizer'
import {
  SubmissionCreateRequestSchema,
  parseActivityCode,
  parseSubmissionStatus,
  parseAmplifyPayload,
  parseSubmissionPayload,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  SubmissionLimitError,
  LEARN,
  AMPLIFY,
  VISIBILITY_OPTIONS,
  SUBMISSION_STATUSES,
} from '@elevate/types'
import { activityCanon } from '@elevate/types/activity-canon'
import {
  transformPayloadAPIToDB,
  transformPayloadDBToAPI,
} from '@elevate/types/dto-mappers'

export const runtime = 'nodejs'

// Use shared request schema from @elevate/types
const SubmissionRequestSchema = SubmissionCreateRequestSchema

export const POST = withCSRFProtection(
  withApiErrorHandling(async (request: NextRequest, context: ApiContext) => {
    // Apply rate limiting for submissions
    return withRateLimit(request, submissionRateLimiter, async () => {
      const sloStart = Date.now()
      const baseLogger = await getSafeServerLogger('submissions')
      const logger = baseLogger.forRequestWithHeaders
        ? baseLogger.forRequestWithHeaders(request)
        : baseLogger
      const t0 = Date.now()
      const { userId } = await auth()

      if (!userId) {
        throw new AuthenticationError()
      }

      // Verify user exists in database
      const user = await findUserById(userId)

      if (!user) {
        throw new NotFoundError('User', userId, context.traceId)
      }

      if (user.user_type === 'STUDENT') {
        throw new AuthorizationError(
          'Student accounts are not eligible to submit',
          context.traceId,
        )
      }

      const body: unknown = await request.json()
      let validatedData: z.infer<typeof SubmissionRequestSchema>

      try {
        validatedData = SubmissionRequestSchema.parse(body)
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(
            error,
            'Invalid submission data',
            context.traceId,
          )
        }
        throw error
      }

      // Sanitize client payload (camelCase) then transform to DB shape (snake_case)
      const sanitizedApiPayload = sanitizeSubmissionPayload(
        validatedData.activityCode,
        validatedData.payload as Record<string, unknown>,
      )

      // Transform payload from API format (camelCase) to DB format (snake_case)
      const dbPayload = transformPayloadAPIToDB(
        validatedData.activityCode,
        sanitizedApiPayload,
      )

      // Validate the DB payload against canonical schemas for the selected activity
      const dbPayloadValidation = parseSubmissionPayload({
        activityCode: validatedData.activityCode,
        data: dbPayload,
      })
      if (!dbPayloadValidation) {
        throw new ValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: 'Invalid payload structure',
              path: ['payload'],
            },
          ]),
          'Invalid payload for selected activity',
          context.traceId,
        )
      }

      // Verify activity exists
      const activity = await findActivityByCode(validatedData.activityCode)

      if (!activity) {
        throw new NotFoundError(
          'Activity',
          validatedData.activityCode,
          context.traceId,
        )
      }

      // Check for existing pending/approved submissions for certain activities
      if (validatedData.activityCode === LEARN) {
        const existingSubmissions = await findSubmissionsByUserAndActivity(
          userId,
          validatedData.activityCode,
          [SUBMISSION_STATUSES[0], SUBMISSION_STATUSES[1]],
        )

        if (existingSubmissions.length > 0) {
          const [existingSubmission] = existingSubmissions
          if (!existingSubmission) {
            throw new ValidationError(
              new z.ZodError([
                {
                  code: 'custom',
                  message: 'Existing submission not found',
                  path: ['activityCode'],
                },
              ]),
              'Duplicate submission not allowed',
              context.traceId,
            )
          }
          throw new ValidationError(
            new z.ZodError([
              {
                code: 'custom',
                message: `You already have a ${existingSubmission.status.toLowerCase()} ${
                  validatedData.activityCode
                } submission`,
                path: ['activityCode'],
              },
            ]),
            'Duplicate submission not allowed',
            context.traceId,
          )
        }
      }

      // For Amplify submissions, check 7-day rolling limits
      if (validatedData.activityCode === AMPLIFY) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentSubmissions = await findSubmissionsWithFilters({
          where: {
            user_id: userId,
            activity_code: AMPLIFY,
            created_at: { gte: sevenDaysAgo },
          },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            payload: true,
          },
        })

        // Calculate total peers and students trained in last 7 days
        const totalPeers = recentSubmissions.reduce(
          (sum: number, sub: { id: string; payload: unknown }) => {
            const parsed = parseAmplifyPayload({
              activityCode: AMPLIFY,
              data: sub.payload,
            })
            const peers =
              (parsed && typeof parsed === 'object' && parsed !== null
                ? (parsed as { data?: { peers_trained?: number } }).data
                    ?.peers_trained
                : 0) || 0
            return sum + peers
          },
          0,
        )

        const totalStudents = recentSubmissions.reduce(
          (sum: number, sub: { id: string; payload: unknown }) => {
            const parsed = parseAmplifyPayload({
              activityCode: AMPLIFY,
              data: sub.payload,
            })
            const students =
              (parsed && typeof parsed === 'object' && parsed !== null
                ? (parsed as { data?: { students_trained?: number } }).data
                    ?.students_trained
                : 0) || 0
            return sum + students
          },
          0,
        )

        // Parse the new submission payload
        const newPayload = parseAmplifyPayload({
          activityCode: AMPLIFY,
          data: dbPayload,
        })
        if (!newPayload) {
          throw new ValidationError(
            new z.ZodError([
              {
                code: 'custom',
                message: 'Invalid AMPLIFY payload format',
                path: ['payload'],
              },
            ]),
            'Invalid AMPLIFY payload format',
            context.traceId,
          )
        }

        const newPeers = newPayload.data.peers_trained || 0
        const newStudents = newPayload.data.students_trained || 0

        if (totalPeers + newPeers > activityCanon.amplify.limits.weeklyPeers) {
          throw new SubmissionLimitError(
            'Peer training',
            totalPeers + newPeers,
            activityCanon.amplify.limits.weeklyPeers,
            context.traceId,
          )
        }

        if (
          totalStudents + newStudents >
          activityCanon.amplify.limits.weeklyStudents
        ) {
          throw new SubmissionLimitError(
            'Student training',
            totalStudents + newStudents,
            activityCanon.amplify.limits.weeklyStudents,
            context.traceId,
          )
        }
      }

      // Create submission
      const submission = await createSubmission({
        user_id: userId,
        activity_code: validatedData.activityCode,
        // Cast via unknown to satisfy exactOptionalPropertyTypes with Prisma JSON
        payload: dbPayload as unknown as Prisma.InputJsonValue,
        visibility: validatedData.visibility || VISIBILITY_OPTIONS[0], // PRIVATE
      })

      // Persist attachments as relational rows
      if (
        Array.isArray(validatedData.attachments) &&
        validatedData.attachments.length > 0
      ) {
        const validAttachments = validatedData.attachments.filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        )

        for (const path of validAttachments) {
          try {
            await createSubmissionAttachment({
              submission_id: submission.id,
              path,
              hash: null,
            })
          } catch (error) {
            // Skip duplicates silently
            console.warn(`Failed to create attachment ${path}:`, error)
          }
        }
      }

      const response = createSuccessResponse(
        {
          id: submission.id,
          activityCode: submission.activity_code,
          status: submission.status,
          visibility: submission.visibility,
          createdAt: submission.created_at,
          potentialPoints: activity.default_points,
        },
        201,
      )
      logger.info('submission.created', {
        activityCode: submission.activity_code,
        userId,
        durationMs: Date.now() - t0,
      })
      recordApiAvailability('/api/submissions', 'POST', 201)
      recordApiResponseTime(
        '/api/submissions',
        'POST',
        Date.now() - sloStart,
        201,
      )
      return response
    })
  }),
)

export const GET = withApiErrorHandling(
  async (request: NextRequest, _context: ApiContext) => {
    const sloStart = Date.now()
    const { userId } = await auth()

    if (!userId) {
      throw new AuthenticationError()
    }

    const url = new URL(request.url)
    const activityCode = url.searchParams.get('activity')
    const status = url.searchParams.get('status')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0)

    const whereClause: Prisma.SubmissionWhereInput = {
      user_id: userId,
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

    const baseLogger = await getSafeServerLogger('submissions')
    const logger = baseLogger.forRequestWithHeaders
      ? baseLogger.forRequestWithHeaders(request)
      : baseLogger
    const t0 = Date.now()
    const { submissions, totalCount } = await findSubmissionsWithPagination(
      whereClause,
      limit,
      offset,
    )

    const resp = createSuccessResponse({
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
        payload: transformPayloadDBToAPI(
          submission.activity_code,
          submission.payload,
        ),
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
    logger.info('submission.list', {
      userId,
      activityCode: whereClause.activity_code,
      status: whereClause.status,
      limit,
      offset,
      durationMs: Date.now() - t0,
    })
    recordApiAvailability('/api/submissions', 'GET', 200)
    recordApiResponseTime('/api/submissions', 'GET', Date.now() - sloStart, 200)
    return resp
  },
)
