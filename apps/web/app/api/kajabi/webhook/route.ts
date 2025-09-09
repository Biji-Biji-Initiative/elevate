import crypto from 'crypto'

import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createSuccessResponse, withApiErrorHandling, type ApiContext } from '@elevate/http'
import { withRateLimit, webhookRateLimiter } from '@elevate/security'
import {
  parseKajabiWebhook,
  safeGet,
  isString,
  toPrismaJson,
  buildAuditMeta,
  type KajabiTagEvent,
  type AuditEntityType,
  ElevateApiError,
  ACTIVITY_CODES,
  SUBMISSION_STATUSES,
  VISIBILITY_OPTIONS,
  LEDGER_SOURCES,
} from '@elevate/types'
// (moved @elevate/http import above to satisfy import/order)

// Local wrapper to ensure type safety for object inputs
function toPrismaJsonObject(
  obj: object,
): Exclude<ReturnType<typeof toPrismaJson>, null> {
  const result = toPrismaJson(obj)
  if (result === null) {
    throw new Error('Unexpected null result from non-null object')
  }
  return result
}

// Local wrapper for audit meta to ensure type safety
function buildAuditMetaSafe(
  envelope: { entityType: AuditEntityType; entityId: string },
  meta?: Record<string, unknown>,
) {
  const result = buildAuditMeta(envelope, meta)
  if (result === null) {
    throw new Error('Unexpected null result from audit meta')
  }
  return result
}

export const runtime = 'nodejs'

// Verify webhook signature from Kajabi with timing-safe comparison
function verifySignature(payload: string, signature: string): boolean {
  if (!process.env.KAJABI_WEBHOOK_SECRET) {
    return false
  }

  if (!signature || signature.length === 0) {
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.KAJABI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  // Ensure both buffers have the same length before timing-safe comparison
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false
  }

  // Compare signatures securely
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}

// Process tag-based events from Kajabi
async function processTagEvent(eventData: KajabiTagEvent, eventId: string) {
  try {
    const { contact, tag } = eventData

    // Extract contact information
    const email = contact.email?.toLowerCase().trim()
    const contactId = contact.id
    const tagName = tag.name

    if (!email || !tagName) {
      throw new Error('Required fields missing: email and tag name')
    }

    // Only process LEARN_COMPLETED tags
    if (tagName !== 'LEARN_COMPLETED') {
      return { success: true, reason: 'tag_not_processed', tag: tagName }
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Store for manual review
      const userNotFoundPayload = toPrismaJsonObject({
        ...eventData,
        processing_status: 'user_not_found',
        stored_at: new Date().toISOString(),
      })

      await prisma.kajabiEvent.create({
        data: {
          id: eventId,
          payload: userNotFoundPayload,
          // processed_at and user_match are omitted (will be null by default)
        },
      })
      return { success: false, reason: 'user_not_found', email }
    }

    // Update user with Kajabi contact ID if not already set
    if (!user.kajabi_contact_id && contactId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { kajabi_contact_id: contactId.toString() },
      })
    }

    // Check for duplicate processing using both event ID and external_event_id in points ledger
    const existingEvent = await prisma.kajabiEvent.findUnique({
      where: { id: eventId },
    })

    if (existingEvent) {
      return { success: true, reason: 'already_processed', event_id: eventId }
    }

    // Additional idempotency check in points ledger to prevent double point awards
    const existingPointsEntry = await prisma.pointsLedger.findFirst({
      where: {
        external_event_id: eventId,
        external_source: 'kajabi',
      },
    })

    if (existingPointsEntry) {
      // Event exists in ledger but not in kajabi_events - create the event record
      const eventPayload = toPrismaJsonObject({
        ...eventData,
        processing_status: 'already_processed_in_ledger',
        processed_at: new Date().toISOString(),
        duplicate_found: true,
      })

      await prisma.kajabiEvent.create({
        data: {
          id: eventId,
          payload: eventPayload,
          processed_at: new Date(),
          user_match: user.id,
        },
      })

      return {
        success: true,
        reason: 'already_processed_in_ledger',
        event_id: eventId,
      }
    }

    // Award points for LEARN activity
    const learnActivity = await prisma.activity.findUnique({
      where: { code: ACTIVITY_CODES[0] }, // LEARN
    })

    if (!learnActivity) {
      throw new Error('LEARN activity not found in database')
    }

    // Create points ledger entry
    await prisma.pointsLedger.create({
      data: {
        user_id: user.id,
        activity_code: ACTIVITY_CODES[0], // LEARN
        source: LEDGER_SOURCES[1], // WEBHOOK
        delta_points: learnActivity.default_points,
        external_source: 'kajabi',
        external_event_id: eventId,
      },
    })

    // Create submission record for audit trail
    await prisma.submission.create({
      data: {
        user_id: user.id,
        activity_code: ACTIVITY_CODES[0], // LEARN
        status: SUBMISSION_STATUSES[1], // APPROVED
        visibility: VISIBILITY_OPTIONS[0], // PRIVATE
        payload: {
          tag_name: tagName,
          kajabi_contact_id: contactId,
          completion_date: new Date().toISOString(),
          provider: 'Kajabi',
          auto_approved: true,
          source: 'tag_webhook',
        },
        attachments: [],
      },
    })

    // Store processed event
    const processedEventPayload = toPrismaJsonObject({
      ...eventData,
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })

    await prisma.kajabiEvent.create({
      data: {
        id:
          eventData.event_id ||
          `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
        payload: processedEventPayload,
        processed_at: new Date(),
        user_match: user.id,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: 'system',
        action: 'KAJABI_COMPLETION_PROCESSED',
        target_id: user.id,
        meta: buildAuditMetaSafe(
          {
            entityType: 'kajabi',
            entityId: String(
              eventData.event_id ||
                `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
            ),
          },
          {
            event_id:
              eventData.event_id ||
              `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
            tag_name: tagName,
            kajabi_contact_id: contactId,
            points_awarded: learnActivity.default_points,
          },
        ),
      },
    })

    return {
      success: true,
      user_id: user.id,
      points_awarded: learnActivity.default_points,
      tag_name: tagName,
      kajabi_contact_id: contactId,
    }
  } catch (error) {
    // Store failed event for manual review
    try {
      const failedEventPayload = toPrismaJsonObject({
        ...eventData,
        error: error instanceof Error ? error.message : String(error),
        failed_at: new Date().toISOString(),
      })

      await prisma.kajabiEvent.create({
        data: {
          id:
            eventData.event_id ||
            `${eventData.event_type}_${eventData.contact.id}_${Date.now()}`,
          payload: failedEventPayload,
          // processed_at and user_match omitted (will be null by default)
        },
      })
    } catch (dbError) {
      // Intentionally ignore database errors when logging failed events
      // The original error should still be thrown to maintain error handling
    }

    throw error
  }
}

export const POST = withApiErrorHandling(
  async (request: NextRequest, context: ApiContext) => {
    // Apply rate limiting first
    return withRateLimit(request, webhookRateLimiter, async () => {
      const body = await request.text()
        const headersList = await headers()

        // Parse JSON first (we'll validate specific schemas by event type)
        let rawEventData: unknown
        try {
          rawEventData = JSON.parse(body)
        } catch (parseError) {
          throw new ElevateApiError(
            'Webhook payload must be valid JSON',
            'VALIDATION_ERROR',
            { parseError: String(parseError) },
            context.traceId
          )
        }

        // Parse and validate the initial webhook structure
        const parseResult = parseKajabiWebhook(rawEventData)

        // Validate payload structure first
        if (!rawEventData || typeof rawEventData !== 'object') {
          throw new ElevateApiError(
            'Webhook payload must be a valid object',
            'VALIDATION_ERROR',
            { received: typeof rawEventData },
            context.traceId
          )
        }

        // Use parsed and validated data from parseResult
        const eventData = parseResult || rawEventData

        // Compute a stable event fingerprint to ensure idempotency
        const fingerprint = crypto
          .createHash('sha256')
          .update(body)
          .digest('hex')
        // Prefer provider event_id; otherwise use fingerprint-based ID
        const providerEventId =
          parseResult?.event_id ||
          safeGet(rawEventData, 'event_id', isString)
        const eventType =
          parseResult?.event_type ||
          safeGet(rawEventData, 'event_type', isString)
        const stableEventId = String(providerEventId || `kajabi:${fingerprint}`)

        if (stableEventId || eventType) {
          try {
            const auditPayload = toPrismaJsonObject({
              ...(typeof rawEventData === 'object' && rawEventData !== null
                ? rawEventData
                : {}),
              received_at: new Date().toISOString(),
              validation_status: parseResult ? 'valid' : 'invalid_format',
            })

            await prisma.kajabiEvent.upsert({
              where: { id: stableEventId },
              update: {
                payload: auditPayload,
              },
              create: {
                id: stableEventId,
                payload: auditPayload,
                // processed_at and user_match omitted (will be null by default)
              },
            })
          } catch (storeError) {
            // Continue processing even if storage fails
          }
        }

        // Get signature from headers (format may vary by platform)
        const signature =
          headersList.get('x-kajabi-signature') ||
          headersList.get('signature') ||
          headersList.get('authorization')?.replace('Bearer ', '')

        if (!signature) {
          throw new ElevateApiError(
            'Missing webhook signature',
            'WEBHOOK_VALIDATION_FAILED',
            { required: ['x-kajabi-signature', 'signature', 'authorization'] },
            context.traceId,
          )
        }

        // Verify webhook signature with enhanced security
        if (!verifySignature(body, signature)) {
          throw new ElevateApiError(
            'Invalid webhook signature',
            'WEBHOOK_VALIDATION_FAILED',
            { signature: signature.substring(0, 10) + '...' },
            context.traceId,
          )
        }

        // Handle different event types
        switch (eventType) {
          case 'contact.tagged':
            // Use the already parsed result
            if (!parseResult) {
              throw new ElevateApiError(
                'Event payload does not match expected KajabiTagEvent schema',
                'VALIDATION_ERROR',
                { eventType: 'contact.tagged' },
                context.traceId
              )
            }

            const result = await processTagEvent(
              parseResult,
              parseResult.event_id || `kajabi_contact_tagged_${Date.now()}`,
            )

            return createSuccessResponse({
              event_id:
                parseResult.event_id || `kajabi_contact_tagged_${Date.now()}`,
              processed_at: new Date().toISOString(),
              result,
            })

          case 'form.submitted':
          case 'purchase.created':
            // Store all events for audit but don't process
            const auditOnlyPayload = toPrismaJsonObject({
              ...eventData,
              stored_at: new Date().toISOString(),
              processing_status: 'audit_only',
            })

            await prisma.kajabiEvent.create({
              data: {
                id: stableEventId,
                payload: auditOnlyPayload,
                // processed_at and user_match omitted (will be null by default)
              },
            })

            return createSuccessResponse({
              event_id: stableEventId,
              event_type: eventType,
              message: `Event type ${String(eventType)} stored for audit`,
              processed_at: new Date().toISOString(),
            })

          default:
            // Store unknown events for audit
            const unknownEventPayload = toPrismaJsonObject({
              ...eventData,
              stored_at: new Date().toISOString(),
              processing_status: 'unknown_event_type',
            })

            await prisma.kajabiEvent.create({
              data: {
                id: stableEventId,
                payload: unknownEventPayload,
                // processed_at and user_match omitted (will be null by default)
              },
            })

            return createSuccessResponse({
              event_id: stableEventId,
              event_type: eventType,
              message: `Event type ${String(eventType)} stored for audit`,
              processed_at: new Date().toISOString(),
            })
        }
    })
  },
)

// Health check for webhook endpoint
export const GET = withApiErrorHandling(
  async (_request: NextRequest, context: ApiContext) => {
    return createSuccessResponse({
      status: 'healthy',
      webhook_url: '/api/kajabi/webhook',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
      trace_id: context.traceId,
    })
  },
)
