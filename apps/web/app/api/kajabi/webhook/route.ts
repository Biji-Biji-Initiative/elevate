import crypto from 'crypto'

import { type NextRequest } from 'next/server'

import type { Prisma as PrismaNS } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse, TRACE_HEADER } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { getWebRuntimeConfig } from '@elevate/config/runtime'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { grantBadgesForUser } from '@elevate/logic'
import {
  withRateLimit,
  webhookRateLimiter,
} from '@elevate/security/rate-limiter'
import { activityCanon } from '@elevate/types/activity-canon'
import { KajabiTagEventSchema } from '@elevate/types/webhooks'

//

export const runtime = 'nodejs'

// Avoid name collision with Next.js `runtime` export
const cfg = getWebRuntimeConfig()
const COURSE_TAGS = new Set(cfg.kajabi.learnTags)

function verifySignature(body: string, signature: string | null): boolean {
  const secret = cfg.kajabi.webhookSecret
  if (!secret || !signature) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

function isUniqueConstraintError(
  err: unknown,
): err is PrismaNS.PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  )
}

export async function POST(request: NextRequest) {
  const baseLogger = await getSafeServerLogger('kajabi-webhook')
  const logger = createRequestLogger(baseLogger, request)
  const start = Date.now()
  const traceId = request.headers.get('x-trace-id') || request.headers.get(TRACE_HEADER) || undefined
  const withTrace = (context: Record<string, unknown> = {}) =>
    (traceId ? { ...context, traceId } : context)
  return withRateLimit(request, webhookRateLimiter, async () => {
    const bodyText = await request.text()
    const allowUnsigned = cfg.kajabi.allowUnsigned
    const signature = request.headers.get('x-kajabi-signature')
    const signedOk = verifySignature(bodyText, signature)
    if (!signedOk && !allowUnsigned) {
      const msg = signature ? 'Invalid webhook signature' : 'Missing webhook signature'
      logger.warn(msg, withTrace({ url: request.url }))
      recordApiAvailability('/api/kajabi/webhook', 'POST', 401)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 401)
      return createErrorResponse(new Error(msg), 401)
    }

    let payloadUnknown: unknown
    try {
      payloadUnknown = JSON.parse(bodyText)
    } catch {
      logger.warn('Invalid JSON body for Kajabi webhook', withTrace())
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      return createErrorResponse(new Error('Invalid JSON'), 400)
    }

    // Try our simple schema first; if it fails, try JSON:API fallback (v1 webhooks)
    let payload: { event_type: string; contact: { id: number | string; email: string }; tag: { name: string } }
    const base = KajabiTagEventSchema.safeParse(payloadUnknown)
    if (base.success) {
      payload = base.data
    } else {
      // JSON:API fallback: extract from data/attributes and included arrays
      const obj = payloadUnknown as any
      try {
        const eventType = obj?.data?.attributes?.event || obj?.event || 'tag.added'
        const included = Array.isArray(obj?.included) ? obj.included : []
        const contactNode = included.find((n: any) => n?.type === 'contacts' || n?.type === 'contact')
        const tagNode = included.find((n: any) => n?.type === 'tags' || n?.type === 'tag')
        const email = contactNode?.attributes?.email || contactNode?.attributes?.email_address
        const tagName = (tagNode?.attributes?.name || tagNode?.attributes?.title || '').toLowerCase()
        if (!email || !tagName) throw new Error('Missing email or tag name in JSON:API payload')
        payload = { event_type: String(eventType), contact: { id: contactNode?.id || 0, email: String(email) }, tag: { name: String(tagName) } }
      } catch (e) {
        // Store unknown payloads for audit instead of rejecting
        try {
          const unknownId = String((payloadUnknown as any)?.event_id || `unknown_${Date.now()}`)
          await prisma.kajabiEvent.create({
            data: {
              id: unknownId,
              event_id: unknownId,
              tag_name_raw: String((payloadUnknown as any)?.tag?.name || 'unknown'),
              tag_name_norm: String((payloadUnknown as any)?.tag?.name || 'unknown').toLowerCase(),
              contact_id: String((payloadUnknown as any)?.contact?.id || ''),
              email: (payloadUnknown as any)?.contact?.email || null,
              created_at_utc: new Date(),
              status: 'stored_unknown',
              raw: payloadUnknown as object,
              payload: payloadUnknown as object,
            },
          })
        } catch {
          // ignore storage failure for unknown payloads
        }
        const res = createSuccessResponse({ message: 'Stored for audit' })
        recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
        recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
        return res
      }
    }

    // Event time: prefer created_at if present; else fallback to now
    let createdAt = Date.now()
    if (typeof (payloadUnknown as any)?.created_at === 'string') {
      const t = Date.parse((payloadUnknown as any).created_at)
      if (!Number.isNaN(t)) createdAt = t
    } else if (typeof (payloadUnknown as any)?.data?.attributes?.created_at === 'string') {
      const t = Date.parse((payloadUnknown as any).data.attributes.created_at)
      if (!Number.isNaN(t)) createdAt = t
    }
    if (Number.isNaN(createdAt)) {
      logger.warn('Kajabi webhook missing created_at', withTrace())
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      return createErrorResponse(new Error('created_at required'), 400)
    }

    const replay = request.headers.get('x-admin-replay') === 'true'
    if (Math.abs(Date.now() - createdAt) > 5 * 60 * 1000 && !replay) {
      logger.warn('Kajabi webhook outside allowed window', withTrace({
        createdAt,
        replay,
      }))
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      return createErrorResponse(
        new Error('Event timestamp outside allowed window'),
        400,
      )
    }

    const eventId = String((payload as { event_id?: unknown })?.event_id ?? '')
    const tagRaw = String(payload.tag?.name ?? '')
    const tagNorm = tagRaw.toLowerCase().trim()
    const contactId = String(payload.contact?.id ?? '')
    const email = payload.contact?.email
      ? String(payload.contact.email).toLowerCase().trim()
      : undefined
    const eventTime = new Date(createdAt)
    const externalEventId = eventId

    try {
      return await prisma.$transaction(async (tx) => {
        // Deduplicate by event id across runs
        const existing = await tx.kajabiEvent.findUnique({ where: { id: eventId } })
        if (existing) {
          logger.info('Kajabi event already processed', withTrace({ eventId }))
          const res = createSuccessResponse({ event_id: eventId, result: { success: true, reason: 'already_processed' } })
          recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
          recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
          return res
        }
        await tx.kajabiEvent.create({
          data: {
            id: eventId,
            event_id: eventId,
            tag_name_raw: tagRaw,
            tag_name_norm: tagNorm,
            contact_id: contactId,
            email: email ?? null,
            created_at_utc: eventTime,
            status: 'received',
            raw: payload,
            payload,
          },
        })

        if (!COURSE_TAGS.has(tagNorm)) {
          await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'ignored' } })
          const res = createSuccessResponse({ event_id: eventId, result: { success: true, reason: 'tag_not_processed' } })
          recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
          recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
          return res
        }

        let user = await tx.user.findUnique({
          where: { kajabi_contact_id: contactId },
        })
        if (!user && email) {
          user = await tx.user.findUnique({ where: { email } })
          if (user && !user.kajabi_contact_id) {
            await tx.user.update({
              where: { id: user.id },
              data: { kajabi_contact_id: contactId },
            })
          }
        }

        if (!user) {
          await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'queued_unmatched' } })
          return createSuccessResponse({ event_id: eventId, result: { success: false, reason: 'user_not_found' } }, 200)
        }

        if (user.user_type === 'STUDENT') {
          await tx.kajabiEvent.update({
            where: {
              event_id_tag_name_norm: {
                event_id: eventId,
                tag_name_norm: tagNorm,
              },
            },
            data: { status: 'student' },
          })
            recordApiAvailability('/api/kajabi/webhook', 'POST', 403)
            recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 403)
            return createErrorResponse(
              new Error('Student accounts are not eligible'),
              403,
            )
        }

        try {
          await tx.learnTagGrant.create({
            data: {
              user_id: user.id,
              tag_name: tagNorm,
              granted_at: eventTime,
            },
          })
        } catch (e: unknown) {
          if (isUniqueConstraintError(e)) {
            await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'duplicate', user_match: user.id } })
            logger.info('Kajabi grant deduplicated', withTrace({ userId: user.id, tagNorm }))
            const res = createSuccessResponse({ event_id: eventId, result: { success: true, reason: 'already_processed' } })
            recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
            recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
            return res
          }
          throw e
        }

        try {
          await tx.pointsLedger.create({
            data: {
              user_id: user.id,
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
          if (isUniqueConstraintError(e)) {
            await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'duplicate', user_match: user.id } })
            logger.info('Kajabi points deduplicated', withTrace({ userId: user.id, externalEventId }))
            return createSuccessResponse({ event_id: eventId, result: { success: true, reason: 'already_processed' } })
          }
          throw e
        }

        // Create audit submission
        await tx.submission.create({
          data: {
            user_id: user.id,
            activity_code: 'LEARN',
            status: 'APPROVED' as any,
            visibility: 'PRIVATE' as any,
            payload: {
              tag_name: tagRaw,
              kajabi_contact_id: Number(contactId) || contactId,
              provider: 'Kajabi',
              auto_approved: true,
              source: 'tag_webhook',
            },
          },
        })

        // Audit log entry
        await tx.auditLog.create({
          data: {
            actor_id: 'system',
            action: 'KAJABI_COMPLETION_PROCESSED',
            target_id: user.id,
            meta: { event_id: eventId, tag_name: tagRaw },
          },
        })

        await grantBadgesForUser(tx, user.id)

        await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'processed', user_match: user.id, processed_at: new Date() } })

        const res = createSuccessResponse({ event_id: eventId, result: { success: true, user_id: user.id, points_awarded: activityCanon.learn.perTag, tag_name: tagRaw, kajabi_contact_id: contactId } })
        recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
        recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
        return res
      })
    } catch (error: unknown) {
      logger.error('Error processing Kajabi webhook', error instanceof Error ? error : new Error(String(error)), withTrace({ eventId, tagNorm, contactId }))
      recordApiAvailability('/api/kajabi/webhook', 'POST', 500)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 500)
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
