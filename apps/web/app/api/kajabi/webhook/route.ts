import crypto from 'crypto'

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@elevate/db/client'
import { withRateLimit, webhookRateLimiter } from '@elevate/security/rate-limiter'
import { grantBadgesForUser } from '@elevate/logic'
import type { ErrorEnvelope } from '@elevate/types'

export const runtime = 'nodejs'

const COURSE_TAGS = new Set(['elevate-ai-1-completed', 'elevate-ai-2-completed'])

function errorResponse(status: number, envelope: ErrorEnvelope) {
  return NextResponse.json({ error: envelope }, { status })
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.KAJABI_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, webhookRateLimiter, async () => {
    const bodyText = await request.text()
    if (!verifySignature(bodyText, request.headers.get('x-kajabi-signature'))) {
      return errorResponse(401, {
        type: 'auth',
        code: 'INVALID_SIGNATURE',
        message: 'Invalid webhook signature',
      })
    }

    let payload: any
    try {
      payload = JSON.parse(bodyText)
    } catch {
      return errorResponse(400, {
        type: 'validation',
        code: 'INVALID_JSON',
        message: 'Body must be valid JSON',
      })
    }

    const createdAt = Date.parse(payload.created_at as string)
    if (Number.isNaN(createdAt)) {
      return errorResponse(400, {
        type: 'validation',
        code: 'MISSING_CREATED_AT',
        message: 'created_at required',
      })
    }

    const replay = request.headers.get('x-admin-replay') === 'true'
    if (Math.abs(Date.now() - createdAt) > 5 * 60 * 1000 && !replay) {
      return errorResponse(400, {
        type: 'auth',
        code: 'TIMESTAMP_SKEW',
        message: 'Event timestamp outside allowed window',
      })
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
        } catch (e: any) {
          if (e.code === 'P2002') {
            return NextResponse.json({ duplicate: true })
          }
          throw e
        }

        if (!COURSE_TAGS.has(tagNorm)) {
          await tx.kajabiEvent.update({
            where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
            data: { status: 'ignored' },
          })
          return NextResponse.json({ ignored: true }, { status: 202 })
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
          return NextResponse.json({ queued: true }, { status: 202 })
        }

        if (user.user_type === 'STUDENT') {
          await tx.kajabiEvent.update({
            where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
            data: { status: 'student' },
          })
          return errorResponse(403, {
            type: 'auth',
            code: 'STUDENT_NOT_ELIGIBLE',
            message: 'Student accounts are not eligible',
          })
        }

        try {
          await tx.learnTagGrant.create({
            data: { user_id: user.id, tag_name: tagNorm, granted_at: eventTime },
          })
        } catch (e: any) {
          if (e.code === 'P2002') {
            await tx.kajabiEvent.update({
              where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
              data: { status: 'duplicate' },
            })
            return NextResponse.json({ duplicate: true })
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
              delta_points: 10,
              event_time: eventTime,
              meta: { tag_name: tagNorm },
            },
          })
        } catch (e: any) {
          if (e.code === 'P2002') {
            await tx.kajabiEvent.update({
              where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
              data: { status: 'duplicate' },
            })
            return NextResponse.json({ duplicate: true })
          }
          throw e
        }

        await grantBadgesForUser(tx, user.id)

        await tx.kajabiEvent.update({
          where: { event_id_tag_name_norm: { event_id: eventId, tag_name_norm: tagNorm } },
          data: { status: 'processed' },
        })

        return NextResponse.json({ awarded: true })
      })
    } catch (error: any) {
      return errorResponse(500, {
        type: 'state',
        code: 'UNEXPECTED_ERROR',
        message: 'Unexpected error',
        details: { message: error?.message },
      })
    }
  })
}
