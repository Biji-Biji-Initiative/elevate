import crypto from 'crypto'

import { type NextRequest } from 'next/server'

import type { Prisma as PrismaNS } from '@elevate/db'
import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
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

// Allowed Learn completion tags — configurable via env KAJABI_LEARN_TAGS, else defaults
const DEFAULT_LEARN_TAGS = ['elevate-ai-1-completed', 'elevate-ai-2-completed']
const ENV_TAGS = (process.env.KAJABI_LEARN_TAGS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const COURSE_TAGS = new Set(ENV_TAGS.length > 0 ? ENV_TAGS : DEFAULT_LEARN_TAGS)

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.KAJABI_WEBHOOK_SECRET
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
  const logger = await getSafeServerLogger('kajabi-webhook')
  const start = Date.now()
  return withRateLimit(request, webhookRateLimiter, async () => {
    const bodyText = await request.text()
    const allowUnsigned = process.env.ALLOW_UNSIGNED_KAJABI_WEBHOOK === 'true' || process.env.NODE_ENV !== 'production'
    const signedOk = verifySignature(bodyText, request.headers.get('x-kajabi-signature'))
    if (!signedOk && !allowUnsigned) {
      logger.warn('Invalid webhook signature', { url: request.url })
      recordApiAvailability('/api/kajabi/webhook', 'POST', 401)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 401)
      return createErrorResponse(new Error('Invalid webhook signature'), 401)
    }

    let payloadUnknown: unknown
    try {
      payloadUnknown = JSON.parse(bodyText)
    } catch {
      logger.warn('Invalid JSON body for Kajabi webhook')
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      return createErrorResponse(new Error('Body must be valid JSON'), 400)
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
        logger.warn('Invalid Kajabi webhook payload', { issues: base.error?.issues, fallbackError: (e as Error).message })
        recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
        recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
        return createErrorResponse(new Error('Invalid Kajabi webhook payload'), 400)
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
      logger.warn('Kajabi webhook missing created_at')
      recordApiAvailability('/api/kajabi/webhook', 'POST', 400)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 400)
      return createErrorResponse(new Error('created_at required'), 400)
    }

    const replay = request.headers.get('x-admin-replay') === 'true'
    if (Math.abs(Date.now() - createdAt) > 5 * 60 * 1000 && !replay) {
      logger.warn('Kajabi webhook outside allowed window', {
        createdAt,
        replay,
      })
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
    const externalEventId = `kajabi:${eventId}|tag:${tagNorm}`

    try {
      return await prisma.$transaction(async (tx) => {
        // Deduplicate by event_id + tag
        try {
          await tx.kajabiEvent.create({
            data: {
              event_id: eventId,
              tag_name_raw: tagRaw,
              tag_name_norm: tagNorm,
              contact_id: contactId,
              email: email ?? null,
              created_at_utc: eventTime,
              status: 'received',
              raw: payload,
            },
          })
        } catch (e: unknown) {
          if (isUniqueConstraintError(e)) {
            logger.info('Kajabi event deduplicated (create)', {
              eventId,
              tagNorm,
            })
            const res = createSuccessResponse({ duplicate: true })
            recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
            recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
            return res
          }
          throw e
        }

        if (!COURSE_TAGS.has(tagNorm)) {
          await tx.kajabiEvent.update({
            where: {
              event_id_tag_name_norm: {
                event_id: eventId,
                tag_name_norm: tagNorm,
              },
            },
            data: { status: 'ignored' },
          })
          const res = createSuccessResponse({ ignored: true }, 202)
          recordApiAvailability('/api/kajabi/webhook', 'POST', 202)
          recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 202)
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
          await tx.kajabiEvent.update({
            where: {
              event_id_tag_name_norm: {
                event_id: eventId,
                tag_name_norm: tagNorm,
              },
            },
            data: { status: 'queued_unmatched' },
          })
          return createSuccessResponse({ queued: true }, 202)
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
            await tx.kajabiEvent.update({
              where: {
                event_id_tag_name_norm: {
                  event_id: eventId,
                  tag_name_norm: tagNorm,
                },
              },
              data: { status: 'duplicate' },
            })
            logger.info('Kajabi grant deduplicated', {
              userId: user.id,
              tagNorm,
            })
            const res = createSuccessResponse({ duplicate: true })
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
            await tx.kajabiEvent.update({
              where: {
                event_id_tag_name_norm: {
                  event_id: eventId,
                  tag_name_norm: tagNorm,
                },
              },
              data: { status: 'duplicate' },
            })
            logger.info('Kajabi points deduplicated', {
              userId: user.id,
              externalEventId,
            })
            return createSuccessResponse({ duplicate: true })
          }
          throw e
        }

        await grantBadgesForUser(tx, user.id)

        await tx.kajabiEvent.update({
          where: {
            event_id_tag_name_norm: {
              event_id: eventId,
              tag_name_norm: tagNorm,
            },
          },
          data: { status: 'processed' },
        })

        const res = createSuccessResponse({ awarded: true })
        recordApiAvailability('/api/kajabi/webhook', 'POST', 200)
        recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 200)
        return res
      })
    } catch (error: unknown) {
      logger.error(
        'Error processing Kajabi webhook',
        error instanceof Error ? error : new Error(String(error)),
        { eventId, tagNorm, contactId },
      )
      recordApiAvailability('/api/kajabi/webhook', 'POST', 500)
      recordApiResponseTime('/api/kajabi/webhook', 'POST', Date.now() - start, 500)
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
