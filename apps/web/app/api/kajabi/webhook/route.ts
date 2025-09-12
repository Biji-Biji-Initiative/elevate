import crypto from 'crypto'

import { type NextRequest } from 'next/server'

import type { Prisma as PrismaNS } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse, TRACE_HEADER } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { createRequestLogger } from '@elevate/logging/request-logger'
import { getWebRuntimeConfig } from '@elevate/config/runtime'
import { recordApiAvailability, recordApiResponseTime } from '@elevate/logging/slo-monitor'
import { grantBadgesForUser, processKajabiWebhook, computeExternalEventId } from '@elevate/logic'
import { withRateLimit, webhookRateLimiter } from '@elevate/security'
import { activityCanon } from '@elevate/types/activity-canon'
import { KajabiTagEventSchema } from '@elevate/types/webhooks'

//

export const runtime = 'nodejs'

// Avoid name collision with Next.js `runtime` export
// Read runtime config at request-time to honor test env changes
const initialTags = (getWebRuntimeConfig().kajabi.learnTags && getWebRuntimeConfig().kajabi.learnTags.length > 0)
  ? getWebRuntimeConfig().kajabi.learnTags
  : ['LEARN_COMPLETED']
const COURSE_TAGS_DEFAULT = new Set(initialTags.map((t) => String(t).toLowerCase().trim()))

function verifySignature(body: string, signature: string | null, secret: string | null): boolean {
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
  const cfg = getWebRuntimeConfig()
  const runtimeTags = (cfg.kajabi.learnTags && cfg.kajabi.learnTags.length > 0)
    ? cfg.kajabi.learnTags
    : ['LEARN_COMPLETED']
  const COURSE_TAGS = COURSE_TAGS_DEFAULT.size
    ? COURSE_TAGS_DEFAULT
    : new Set(runtimeTags.map((t) => String(t).toLowerCase().trim()))
  const withTrace = (context: Record<string, unknown> = {}) =>
    (traceId ? { ...context, traceId } : context)
  return withRateLimit(request, webhookRateLimiter, async () => {
    const bodyText = await request.text()
    const allowUnsigned = cfg.kajabi.allowUnsigned
    const signature = request.headers.get('x-kajabi-signature')
    const signedOk = verifySignature(bodyText, signature, cfg.kajabi.webhookSecret)
    if (!signedOk && !allowUnsigned) {
      const msg = signature ? 'Invalid webhook signature' : 'Missing webhook signature'
      logger.warn(msg, withTrace({ url: request.url }))
      // Contract: treat signature problems as Bad Request (400)
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      const { ElevateApiError } = await import('@elevate/types/errors')
      return createErrorResponse(new ElevateApiError(msg, 'VALIDATION_ERROR'), 400)
    }

    let payloadUnknown: unknown
    try {
      payloadUnknown = JSON.parse(bodyText)
    } catch {
      logger.warn('Invalid JSON body for Kajabi webhook', withTrace())
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      const { ElevateApiError } = await import('@elevate/types/errors')
      return createErrorResponse(new ElevateApiError('Invalid JSON', 'VALIDATION_ERROR'), 400)
    }

    // Strictly validate Kajabi tag event shape (no implicit fallbacks)
    const parsed = KajabiTagEventSchema.safeParse(payloadUnknown)
    if (!parsed.success) {
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      const { ElevateApiError } = await import('@elevate/types/errors')
      return createErrorResponse(new ElevateApiError('Invalid webhook payload', 'VALIDATION_ERROR'), 400)
    }
    const payload = parsed.data

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
      const { ElevateApiError } = await import('@elevate/types/errors')
      return createErrorResponse(
        new ElevateApiError('Event timestamp outside allowed window', 'VALIDATION_ERROR'),
        400,
      )
    }

    const eventId = String(payload.event_id ?? '')
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

        // Delegate to logic package for user matching + idempotent writes
        const result = await processKajabiWebhook(tx, { event_id: eventId, event_type: String(payload.event_type || 'contact.tagged') as any, contact: { id: Number.isNaN(Number(contactId)) ? contactId : Number(contactId), email: email || '' }, tag: { name: tagRaw } }, eventTime, {
          allowedTags: COURSE_TAGS,
        })

        if (result.reason === 'user_not_found') {
          await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'queued_unmatched' } })
          return createSuccessResponse({ event_id: eventId, result: { success: false, reason: 'user_not_found' } }, 200)
        }

        // Fetch user for type check if not present
        const user = result.userId ? await tx.user.findUnique({ where: { id: result.userId } }) : null
        if (user && user.user_type === 'STUDENT') {
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

        // Update KajabiEvent status
        const userId = result.userId
        if (result.reason === 'already_processed') {
          await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'duplicate', user_match: userId || undefined } })
          return createSuccessResponse({ event_id: eventId, result: { success: true, reason: 'already_processed', user_id: userId } })
        }

        // Audit log entry
        await tx.auditLog.create({
          data: {
            actor_id: 'system',
            action: 'KAJABI_COMPLETION_PROCESSED',
            target_id: userId!,
            meta: { event_id: eventId, tag_name: tagRaw },
          },
        })

        if (userId) {
          await grantBadgesForUser(tx, userId)
        }

        await tx.kajabiEvent.update({ where: { id: eventId }, data: { status: 'processed', user_match: userId || undefined, processed_at: new Date() } })

        const res = createSuccessResponse({ event_id: eventId, result: { success: true, user_id: userId, points_awarded: activityCanon.learn.perTag, tag_name: tagRaw, kajabi_contact_id: contactId } })
        recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
        recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
        return res
      })
    } catch (error: unknown) {
      logger.error('Error processing Kajabi webhook', error instanceof Error ? error : new Error(String(error)), withTrace({ eventId, tagNorm, contactId }))
      recordApiAvailability('/api/kajabi/webhook', 'POST', 500)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 500)
      // Return a specific error message for observability in tests and logs
      const { ElevateApiError } = await import('@elevate/types/errors')
      return createErrorResponse(new ElevateApiError('Kajabi webhook processing failed', 'INTERNAL_ERROR'), 500)
    }
  })
}
