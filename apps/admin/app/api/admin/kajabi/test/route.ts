import { randomUUID } from 'crypto'

import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { withApiErrorHandling, type ApiContext } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { KajabiTestSchema, buildAuditMeta, toPrismaJson } from '@elevate/types'

export const runtime = 'nodejs'

export const POST = withApiErrorHandling(async (request: NextRequest, _context: ApiContext) => {
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
    // Check admin role
    await requireRole('admin')
    

    const body: unknown = await request.json()
    const parsed = KajabiTestSchema.safeParse(body)
    if (!parsed.success) {
      return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
    }
    const { user_email, course_name = 'Test Course - Admin Console' } =
      parsed.data

    const email = user_email.toLowerCase().trim()

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return toErrorResponse(new AdminError('NOT_FOUND', 'User not found for email: ' + email))
    }

    // Generate unique event ID
    const eventId = `test_${randomUUID()}`

    // Check if user already has LEARN points from Kajabi
    const existingLedgerEntry = await prisma.pointsLedger.findFirst({
      where: {
        user_id: user.id,
        activity_code: 'LEARN',
        external_source: 'kajabi',
      },
    })

    // Award points for LEARN activity
    const learnActivity = await prisma.activity.findUnique({
      where: { code: 'LEARN' },
    })

    if (!learnActivity) {
      return toErrorResponse(new AdminError('INTERNAL', 'LEARN activity not found in database'))
    }

    // Resolve first learn tag from env (fallback to default)
    const envTags = (process.env.KAJABI_LEARN_TAGS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const firstTag = envTags[0] || 'elevate-ai-1-completed'

    // Create test event payload (simulating real Kajabi webhook)
    const testEventData = {
      event_id: eventId,
      event_type: 'contact.tagged',
      created_at: new Date().toISOString(),
      data: {
        contact: {
          id: 'test_contact_' + Date.now(),
          email: user_email,
          first_name: user.name?.split(' ')[0] || 'Test',
          last_name: user.name?.split(' ').slice(1).join(' ') || 'User',
        },
        tag: {
          name: firstTag,
          id: 'test_tag_123',
        },
      },
      source: 'admin_test',
      test_mode: true,
    }

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Create points ledger entry
      const pointsEntry = await tx.pointsLedger.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          source: 'MANUAL',
          delta_points: learnActivity.default_points,
          event_time: new Date(),
          external_source: 'kajabi',
          external_event_id: eventId,
        },
      })

      // Create submission record for audit trail
      const submission = await tx.submission.create({
        data: {
          user_id: user.id,
          activity_code: 'LEARN',
          status: 'APPROVED',
          visibility: 'PRIVATE',
          payload: {
            tag_name: 'LEARN_COMPLETED',
            kajabi_contact_id: testEventData.data.contact.id,
            completion_date: new Date().toISOString(),
            provider: 'Kajabi',
            course_name: course_name,
            auto_approved: true,
            source: 'test_admin',
            test_mode: true,
          },
        },
      })

      // Store the test event
      const kajabiEvent = await tx.kajabiEvent.create({
        data: {
          id: eventId,
          // align to new schema fields
          event_id: eventId,
          tag_name_raw: 'LEARN_COMPLETED',
          tag_name_norm: 'LEARN_COMPLETED',
          contact_id: testEventData.data.contact.id,
          email: email,
          created_at_utc: new Date(),
          status: 'processed',
          raw: toPrismaJson(testEventData) as Prisma.InputJsonValue,
        },
      })

      // Create audit log
      const auditLog = await tx.auditLog.create({
        data: {
          actor_id: 'admin_test',
          action: 'KAJABI_TEST_EVENT_CREATED',
          target_id: user.id,
          meta: buildAuditMeta(
            { entityType: 'kajabi', entityId: eventId },
            {
              event_id: eventId,
              tag_name: 'LEARN_COMPLETED',
              course_name: course_name,
              points_awarded: learnActivity.default_points,
              test_mode: true,
              created_at: new Date().toISOString(),
            },
          ) as Prisma.InputJsonValue,
        },
      })

      return {
        user_id: user.id,
        user_email: email,
        points_awarded: learnActivity.default_points,
        course_name: course_name,
        event_id: eventId,
        submission_id: submission.id,
        points_entry_id: pointsEntry.id,
        kajabi_event_id: kajabiEvent.id,
        audit_log_id: auditLog.id,
        existing_kajabi_points: existingLedgerEntry
          ? existingLedgerEntry.delta_points
          : 0,
      }
    })

    const baseLogger = await getSafeServerLogger('admin-kajabi')
    const logger = createRequestLogger(baseLogger, request)
    logger.info('Created Kajabi test event', { event_id: result.event_id, user_id: result.user_id })

    {
      const res = toSuccessResponse({
      message: 'Test Kajabi event created successfully',
      test_mode: true,
      timestamp: new Date().toISOString(),
      ...result,
      })
      return res
    }
    } catch (error) {
      const baseLogger = await getSafeServerLogger('admin-kajabi')
      const logger = createRequestLogger(baseLogger, request)
      logger.error('Kajabi test event failed', error instanceof Error ? error : new Error(String(error)))
      const errRes = toErrorResponse(error)
      return errRes
    }
  })
})
