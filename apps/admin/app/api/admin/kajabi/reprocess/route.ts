import type { NextRequest } from 'next/server'

import { requireRole } from '@elevate/auth/server-helpers'
import { prisma, type Prisma } from '@elevate/db'
import { AdminError } from '@/lib/server/admin-error'
import { toErrorResponse, toSuccessResponse } from '@/lib/server/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { grantBadgesForUser } from '@elevate/logic'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import {
  toPrismaJson,
  parseKajabiWebhook,
  KajabiReprocessSchema,
  buildAuditMeta,
} from '@elevate/types'
import { activityCanon } from '@elevate/types/activity-canon'

export const runtime = 'nodejs'

function getStringField(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : undefined
  }
  return undefined
}

function getObjectField<T extends object = Record<string, unknown>>(
  obj: unknown,
  key: string,
): T | undefined {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    return v && typeof v === 'object' ? (v as T) : undefined
  }
  return undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
}

type ReprocessResult = {
  user_id: string
  points_awarded: number
  tag_name: string
  kajabi_contact_id: string
  duplicate: boolean
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
    try {
      // Check admin role
      await requireRole('admin')

      const body: unknown = await request.json()
      const parsed = KajabiReprocessSchema.safeParse(body)
      if (!parsed.success) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid request body'))
      }
      const { event_id } = parsed.data

      if (!event_id) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'event_id is required'))
      }

      // Find the Kajabi event
      const kajabiEvent = await prisma.kajabiEvent.findUnique({
        where: { id: event_id },
      })

      if (!kajabiEvent) {
        return toErrorResponse(new AdminError('NOT_FOUND', 'Event not found'))
      }

      // If already marked processed/duplicate/ignored, bail early
      const status = getStringField(kajabiEvent, 'status')
      if (status && status !== 'queued_unmatched') {
        return toErrorResponse(new AdminError('CONFLICT', 'Event already processed'))
      }

      // Parse and validate the event payload
      const eventData = parseKajabiWebhook(
        getObjectField(kajabiEvent, 'raw') ?? getObjectField(kajabiEvent, 'payload') ?? {},
      )

      if (!eventData) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Invalid event payload format'))
      }

      // Process tag-based events only (same logic as webhook)
      if (eventData.event_type !== 'contact.tagged') {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Only contact.tagged events can be reprocessed'))
      }

      const { contact, tag } = eventData

      // Extract contact information
      const email = (contact.email || '').toLowerCase().trim()
      const contactId = String(contact.id)
      const tagRaw = tag.name
      const tagNorm = tagRaw.toLowerCase().trim()

      if (!email || !tagNorm) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Required fields missing: email and tag name'))
      }

      // Accept only official course completion tags
      const COURSE_TAGS = new Set(['elevate-ai-1-completed', 'elevate-ai-2-completed'])
      if (!COURSE_TAGS.has(tagNorm)) {
        return toErrorResponse(new AdminError('VALIDATION_ERROR', 'Unsupported tag for reprocessing'))
      }

      // Try to find user by kajabi_contact_id, then by email
      let user = await prisma.user.findUnique({ where: { kajabi_contact_id: contactId } })
      if (!user) {
        user = await prisma.user.findUnique({ where: { email } })
        if (user && !user.kajabi_contact_id) {
          await prisma.user.update({ where: { id: user.id }, data: { kajabi_contact_id: contactId } })
        }
      }

      if (!user) {
        // Queue unmatched for later reconciliation
        await prisma.kajabiEvent.update({
          where: { id: event_id },
          data: { status: 'queued_unmatched' },
        })
        return toSuccessResponse({ queued: true }, 202)
      }

      if (user.user_type === 'STUDENT') {
        await prisma.kajabiEvent.update({
          where: { id: event_id },
          data: { status: 'student' },
        })
        return toErrorResponse(new AdminError('FORBIDDEN', 'Student accounts are not eligible'))
      }

      const eventTime = kajabiEvent.created_at_utc
      const externalEventId = `kajabi:${kajabiEvent.event_id}|tag:${tagNorm}`
      const matchedUser = user

      // Helper: detect unique violation
      function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
        return (
          typeof err === 'object' &&
          err !== null &&
          'code' in (err as Record<string, unknown>) &&
          (err as { code?: unknown }).code === 'P2002'
        )
      }

      // Start transaction for atomic operation
      const result: ReprocessResult = await prisma.$transaction(async (tx) => {
        // Insert Learn tag grant (idempotent by PK)
        try {
          await tx.learnTagGrant.create({
            data: { user_id: matchedUser.id, tag_name: tagNorm, granted_at: eventTime },
          })
        } catch (e: unknown) {
          if (!isUniqueConstraintError(e)) throw e
          // Duplicate grant: continue
        }

        // Create points ledger entry (idempotent by external_event_id)
        try {
          await tx.pointsLedger.create({
            data: {
              user_id: matchedUser.id,
              activity_code: 'LEARN',
              source: 'WEBHOOK',
              external_source: 'kajabi',
              external_event_id: externalEventId,
              delta_points: activityCanon.learn.perTag,
              event_time: eventTime,
              meta: { tag_name: tagNorm },
            },
          })
        } catch (e: unknown) {
          if (!isUniqueConstraintError(e)) throw e
          // Mark as duplicate
          await tx.kajabiEvent.update({ where: { id: event_id }, data: { status: 'duplicate' } })
          return {
            user_id: matchedUser.id,
            points_awarded: 0,
            tag_name: tagNorm,
            kajabi_contact_id: contactId,
            duplicate: true,
          } satisfies ReprocessResult
        }

        // Evaluate badges
        await grantBadgesForUser(tx, matchedUser.id)

        // Mark event as processed
        await tx.kajabiEvent.update({
          where: { id: event_id },
          data: {
            status: 'processed',
            raw: toPrismaJson({
              ...(isPlainObject(getObjectField(kajabiEvent, 'raw'))
                ? (getObjectField(kajabiEvent, 'raw') as Record<string, unknown>)
                : {}),
              user_match: matchedUser.id,
            }) as Prisma.InputJsonValue,
          },
        })

        // Audit
        await tx.auditLog.create({
          data: {
            actor_id: 'admin',
            action: 'KAJABI_EVENT_REPROCESSED',
          target_id: matchedUser.id,
          meta: buildAuditMeta(
            { entityType: 'kajabi', entityId: event_id },
            {
              event_id: kajabiEvent.event_id,
              tag_name: tagNorm,
              kajabi_contact_id: contactId,
              points_awarded: activityCanon.learn.perTag,
              reprocessed_at: new Date().toISOString(),
            },
          ) as Prisma.InputJsonValue,
          },
        })

        return {
          user_id: matchedUser.id,
          points_awarded: activityCanon.learn.perTag,
          tag_name: tagNorm,
          kajabi_contact_id: contactId,
          duplicate: false,
        } satisfies ReprocessResult
      })

      const logger = await getSafeServerLogger('admin-kajabi')
      logger.info('Reprocessed Kajabi event', {
        event_id: kajabiEvent.id,
        user_id: result.user_id,
        duplicate: result.duplicate,
      })

      return toSuccessResponse({
        message: result.duplicate
          ? 'Event marked as duplicate'
          : 'Event reprocessed successfully',
        ...result,
      })
    } catch (error) {
      return toErrorResponse(error)
    }
  })
}
