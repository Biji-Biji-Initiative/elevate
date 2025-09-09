import crypto from 'crypto'

import { type NextRequest } from 'next/server'

import { prisma } from '@elevate/db/client'
import { createErrorResponse, createSuccessResponse } from '@elevate/http'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { grantBadgesForUser } from '@elevate/logic'
import { withRateLimit, webhookRateLimiter } from '@elevate/security/rate-limiter'
import { KajabiTagEventSchema } from '@elevate/types/webhooks'
import type { Prisma as PrismaNS } from '@elevate/db'
import { activityCanon } from '@elevate/types/activity-canon'

//

export const runtime = 'nodejs'

const COURSE_TAGS = new Set(['elevate-ai-1-completed', 'elevate-ai-2-completed'])

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.KAJABI_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

function isUniqueConstraintError(err: unknown): err is PrismaNS.PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  )
}

export async function POST(request: NextRequest) {
  const logger = await getSafeServerLogger('kajabi-webhook')
  return withRateLimit(request, webhookRateLimiter, async () => {
    const bodyText = await request.text()
    if (!verifySignature(bodyText, request.headers.get('x-kajabi-signature'))) {
      logger.warn('Invalid webhook signature', { url: request.url })
      return createErrorResponse(new Error('Invalid webhook signature'), 401)
    }

    let payloadUnknown: unknown
    try {
      payloadUnknown = JSON.parse(bodyText)
    } catch {
      logger.warn('Invalid JSON body for Kajabi webhook')
      return createErrorResponse(new Error('Body must be valid JSON'), 400)
    }

    // Base schema validation for expected Kajabi payload
    const base = KajabiTagEventSchema.safeParse(payloadUnknown)
    if (!base.success) {
      logger.warn('Invalid Kajabi webhook payload', { issues: base.error?.issues })
      return createErrorResponse(new Error('Invalid Kajabi webhook payload'), 400)
    }

    const payload = base.data as typeof base.data & { created_at?: string }
    const createdAt = Date.parse((payload as { created_at?: string }).created_at ?? '')
    if (Number.isNaN(createdAt)) {
      logger.warn('Kajabi webhook missing created_at')
      return createErrorResponse(new Error('created_at required'), 400)
    }

    const replay = request.headers.get('x-admin-replay') === 'true'
    if (Math.abs(Date.now() - createdAt) > 5 * 60 * 1000 && !replay) {
      logger.warn('Kajabi webhook outside allowed window', { createdAt, replay })
      return createErrorResponse(new Error('Event timestamp outside allowed window'), 400)
    }

    const eventId = String(payload.event_id ?? '')
    const tagRaw = String(payload.tag?.name ?? '')
    const tagNorm = tagRaw.toLowerCase().trim()
    const contactId = String(payload.contact?.id ?? '')
    const email = payload.contact?.email ? String(payload.contact.email).toLowerCase().trim() : undefined
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
              email,
              created_at_utc: eventTime,
              status: 'received',
              raw: payload,
            },
          })
        } catch (e: unknown) {
          if (isUniqueConstraintError(e)) {
            logger.info('Kajabi event deduplicated (create)', { eventId, tagNorm })
            return createSuccessResponse({ duplicate: true })
          }
          throw e
        }

        if (!COURSE_TAGS.has(tagNorm)) {
          await tx.kajabiEvent.update({
            where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
            data: { status: 'ignored' },
          })
          return createSuccessResponse({ ignored: true }, 202)
        }

        let user = await tx.user.findUnique({ where: { kajabi_contact_id: contactId } })
        if (!user && email) {
          user = await tx.user.findUnique({ where: { email } })
          if (user && !user.kajabi_contact_id) {
            await tx.user.update({ where: { id: user.id }, data: { kajabi_contact_id: contactId } })
          }
        }

        if (!user) {
          await tx.kajabiEvent.update({
            where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
            data: { status: 'queued_unmatched' },
          })
          return createSuccessResponse({ queued: true }, 202)
        }

        if (user.user_type === 'STUDENT') {
          await tx.kajabiEvent.update({
            where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
            data: { status: 'student' },
          })
          return createErrorResponse(new Error('Student accounts are not eligible'), 403)
        }

        try {
          await tx.learnTagGrant.create({
            data: { user_id: user.id, tag_name: tagNorm, granted_at: eventTime },
          })
        } catch (e: unknown) {
          if (isUniqueConstraintError(e)) {
            await tx.kajabiEvent.update({
              where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
              data: { status: 'duplicate' },
            })
            logger.info('Kajabi grant deduplicated', { userId: user.id, tagNorm })
            return createSuccessResponse({ duplicate: true })
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
              where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
              data: { status: 'duplicate' },
            })
            logger.info('Kajabi points deduplicated', { userId: user.id, externalEventId })
            return createSuccessResponse({ duplicate: true })
          }
          throw e
        }

        await grantBadgesForUser(tx, user.id)

        await tx.kajabiEvent.update({
          where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
          data: { status: 'processed' },
        })

        return createSuccessResponse({ awarded: true })
      })
    } catch (error: unknown) {
      logger.error(
        'Error processing Kajabi webhook',
        error instanceof Error ? error : new Error(String(error)),
        { eventId, tagNorm, contactId },
      )
      return createErrorResponse(new Error('Internal Server Error'), 500)
    }
  })
}
