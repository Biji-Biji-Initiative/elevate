"use server"
import 'server-only'

import { randomUUID } from 'crypto'

import { toKajabiEvent } from '@/lib/server/mappers'
import { requireRole } from '@elevate/auth/server-helpers'
import {
  prisma,
  findKajabiEvents,
  getKajabiEventStats,
  getKajabiPointsAwarded,
  type Prisma,
} from '@elevate/db'
import { enrollUserInKajabi, isKajabiHealthy } from '@elevate/integrations'
import { getSafeServerLogger } from '@elevate/logging/safe-server'
import { sloMonitor } from '@elevate/logging/slo-monitor'
import { handleApiError } from '@/lib/error-utils'
import { grantBadgesForUser } from '@elevate/logic'
import { recordSLO } from '@/lib/server/obs'
import { AdminError } from '@/lib/server/admin-error'
import {
  KajabiTestSchema,
  buildAuditMeta,
  toPrismaJson,
  parseKajabiWebhook,
} from '@elevate/types'
import { KajabiEventSchema, type KajabiEvent, type KajabiStats } from '@elevate/types/admin-api-types'

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

export async function listKajabiService(): Promise<{ events: KajabiEvent[]; stats: KajabiStats }> {
  await requireRole('admin')
  const start = Date.now()
  try {
    const [events, stats, pointsAwarded] = await Promise.all([
      findKajabiEvents(50),
      getKajabiEventStats(),
      getKajabiPointsAwarded(),
    ])

    const mapped = events.map((e) => KajabiEventSchema.parse(toKajabiEvent(e)))

    const logger = await getSafeServerLogger('admin-kajabi')
    logger.info('Fetched Kajabi events', { count: mapped.length })
    recordSLO('/admin/service/kajabi/list', start, 200)

    return {
      events: mapped,
      stats: { ...stats, points_awarded: pointsAwarded } as KajabiStats,
    }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-kajabi')
    logger.error('List Kajabi events failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/kajabi/list', start, 500)
    throw new Error(handleApiError(err, 'List Kajabi events failed'))
  }
}

export async function kajabiHealthService(): Promise<{ healthy: boolean; hasKey: boolean; hasSecret: boolean }> {
  await requireRole('admin')
  const start = Date.now()
  try {
    const hasKey = !!process.env.KAJABI_API_KEY
    const hasSecret = !!process.env.KAJABI_CLIENT_SECRET
    const healthy = hasKey && hasSecret ? await isKajabiHealthy() : false
    // Record SLO metrics
    sloMonitor.recordApiAvailability('/api/admin/kajabi/health', 'GET', 200)
    sloMonitor.recordApiResponseTime('/api/admin/kajabi/health', 'GET', Date.now() - start, 200)
    return { healthy, hasKey, hasSecret }
  } catch (e) {
    sloMonitor.recordApiAvailability('/api/admin/kajabi/health', 'GET', 500)
    sloMonitor.recordApiResponseTime('/api/admin/kajabi/health', 'GET', 0, 500)
    throw new Error('Failed to check Kajabi health')
  }
}

export async function testKajabiService(body: unknown) {
  await requireRole('admin')
  const start = Date.now()
  try {
  const parsed = KajabiTestSchema.safeParse(body)
  if (!parsed.success) throw new AdminError('VALIDATION_ERROR', 'Invalid request body')
  const { user_email, course_name = 'Test Course - Admin Console' } = parsed.data

  const email = user_email.toLowerCase().trim()
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new AdminError('NOT_FOUND', 'User not found for email: ' + email)

  const eventId = `test_${randomUUID()}`

  const existingLedgerEntry = await prisma.pointsLedger.findFirst({
    where: { user_id: user.id, activity_code: 'LEARN', external_source: 'kajabi' },
  })

  const learnActivity = await prisma.activity.findUnique({ where: { code: 'LEARN' } })
  if (!learnActivity) throw new Error('LEARN activity not found in database')

  const envTags = (process.env.KAJABI_LEARN_TAGS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const firstTag = envTags[0] || 'elevate-ai-1-completed'

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
      tag: { name: firstTag, id: 'test_tag_123' },
    },
    source: 'admin_test',
    test_mode: true,
  }

  const result = await prisma.$transaction(async (tx) => {
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

    const createdEvent = await tx.kajabiEvent.create({
      data: {
        id: eventId,
        event_id: eventId,
        tag_name_raw: 'LEARN_COMPLETED',
        tag_name_norm: 'LEARN_COMPLETED',
        contact_id: testEventData.data.contact.id,
        email: email,
        created_at_utc: new Date(),
        status: 'processed',
        raw: toPrismaJson(testEventData) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    await tx.auditLog.create({
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
      kajabi_event_id: createdEvent.id,
      existing_kajabi_points: existingLedgerEntry ? existingLedgerEntry.delta_points : 0,
    }
  })

  const logger = await getSafeServerLogger('admin-kajabi')
  logger.info('Created Kajabi test event', { event_id: result.event_id, user_id: result.user_id })
  recordSLO('/admin/service/kajabi/test', start, 200)

  return {
    success: true,
    message: 'Test Kajabi event created successfully',
    test_mode: true,
    timestamp: new Date().toISOString(),
    ...result,
  }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-kajabi')
    logger.error('Kajabi test event failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/kajabi/test', start, 500)
    throw new Error(handleApiError(err, 'Kajabi test event failed'))
  }
}

export async function reprocessKajabiService(body: unknown) {
  await requireRole('admin')
  const start = Date.now()
  try {
  const parsed = (await import('zod')).z
    .object({ event_id: (await import('zod')).z.string() })
    .safeParse(body)
  if (!parsed.success) throw new AdminError('VALIDATION_ERROR', 'Invalid request body')
  const { event_id } = parsed.data
  if (!event_id) throw new AdminError('VALIDATION_ERROR', 'event_id is required')

  const kajabiEvent = await prisma.kajabiEvent.findUnique({ where: { id: event_id } })
  if (!kajabiEvent) throw new AdminError('NOT_FOUND', 'Event not found')

  const status = getStringField(kajabiEvent, 'status')
  if (status && status !== 'queued_unmatched') throw new AdminError('CONFLICT', 'Event already processed')

  const eventData = parseKajabiWebhook(
    getObjectField(kajabiEvent, 'raw') ?? getObjectField(kajabiEvent, 'payload') ?? {},
  )
  if (!eventData) throw new AdminError('VALIDATION_ERROR', 'Invalid event payload format')
  if (eventData.event_type !== 'contact.tagged') throw new AdminError('VALIDATION_ERROR', 'Only contact.tagged events can be reprocessed')

  const { contact, tag } = eventData
  const email = (contact.email || '').toLowerCase().trim()
  const contactId = String(contact.id)
  const tagRaw = tag.name
  const tagNorm = tagRaw.toLowerCase().trim()
  if (!email || !tagNorm) throw new AdminError('VALIDATION_ERROR', 'Required fields missing: email and tag name')
  const COURSE_TAGS = new Set(['elevate-ai-1-completed', 'elevate-ai-2-completed'])
  if (!COURSE_TAGS.has(tagNorm)) throw new AdminError('VALIDATION_ERROR', 'Unsupported tag for reprocessing')

  let user = await prisma.user.findUnique({ where: { kajabi_contact_id: contactId } })
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } })
    if (user && !user.kajabi_contact_id) {
      await prisma.user.update({ where: { id: user.id }, data: { kajabi_contact_id: contactId } })
    }
  }

  if (!user) {
    await prisma.kajabiEvent.update({ where: { id: event_id }, data: { status: 'queued_unmatched' } })
    return { queued: true }
  }

  if (user.user_type === 'STUDENT') {
    await prisma.kajabiEvent.update({ where: { id: event_id }, data: { status: 'student' } })
    throw new AdminError('FORBIDDEN', 'Student accounts are not eligible')
  }

  const eventTime = kajabiEvent.created_at_utc
  const externalEventId = `kajabi:${kajabiEvent.event_id}|tag:${tagNorm}`
  const matchedUser = user

  function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in (err as Record<string, unknown>) &&
      (err as { code?: unknown }).code === 'P2002'
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    try {
      await tx.learnTagGrant.create({ data: { user_id: matchedUser.id, tag_name: tagNorm, granted_at: eventTime } })
    } catch (e: unknown) {
      if (!isUniqueConstraintError(e)) throw e
    }

    try {
      await tx.pointsLedger.create({
        data: {
          user_id: matchedUser.id,
          activity_code: 'LEARN',
          source: 'WEBHOOK',
          external_source: 'kajabi',
          external_event_id: externalEventId,
          delta_points: (await import('@elevate/types/activity-canon')).activityCanon.learn.perTag,
          event_time: eventTime,
          meta: { tag_name: tagNorm },
        },
      })
    } catch (e: unknown) {
      if (!isUniqueConstraintError(e)) throw e
      await tx.kajabiEvent.update({ where: { id: event_id }, data: { status: 'duplicate' } })
      return { user_id: matchedUser.id, points_awarded: 0, tag_name: tagNorm, kajabi_contact_id: contactId, duplicate: true as const }
    }

    await grantBadgesForUser(tx, matchedUser.id)

    await tx.kajabiEvent.update({
      where: { id: event_id },
      data: {
        status: 'processed',
        raw: toPrismaJson({ ...(isPlainObject(getObjectField(kajabiEvent, 'raw')) ? (getObjectField(kajabiEvent, 'raw') as Record<string, unknown>) : {}), user_match: matchedUser.id }) as Prisma.InputJsonValue,
      },
    })

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
            points_awarded: (await import('@elevate/types/activity-canon')).activityCanon.learn.perTag,
            reprocessed_at: new Date().toISOString(),
          },
        ) as Prisma.InputJsonValue,
      },
    })

    return { user_id: matchedUser.id, points_awarded: (await import('@elevate/types/activity-canon')).activityCanon.learn.perTag, tag_name: tagNorm, kajabi_contact_id: contactId, duplicate: false as const }
  })

  const logger = await getSafeServerLogger('admin-kajabi')
  logger.info('Reprocessed Kajabi event', { event_id: kajabiEvent.id, user_id: result.user_id, duplicate: result.duplicate })
  recordSLO('/admin/service/kajabi/reprocess', start, 200)

  return { message: result.duplicate ? 'Event marked as duplicate' : 'Event reprocessed successfully', ...result }
  } catch (err) {
    const logger = await getSafeServerLogger('admin-kajabi')
    logger.error('Kajabi reprocess failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/kajabi/reprocess', start, 500)
    throw new Error(handleApiError(err, 'Kajabi reprocess failed'))
  }
}


export async function inviteKajabiService(body: unknown): Promise<{ invited: boolean; contactId?: number; withOffer: boolean; offerIdResolved?: string | number }>
{
  await requireRole('admin')
  const start = Date.now()
  try {
  const z = (await import('zod')).z
  const InviteRequestSchema = z
    .object({ userId: z.string().optional(), email: z.string().email().optional(), name: z.string().optional(), offerId: z.union([z.string(), z.number()]).optional() })
    .refine((v) => !!v.userId || !!v.email, { message: 'userId or email is required' })
  const parsed = InviteRequestSchema.safeParse(body)
  if (!parsed.success) throw new AdminError('VALIDATION_ERROR', parsed.error.issues?.[0]?.message || 'Invalid body')
  const { userId, email: emailInput, name: nameInput, offerId } = parsed.data

  let user: null | { id: string; email: string; name: string | null } = null
  if (userId) {
    const found = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })
    if (!found) throw new AdminError('NOT_FOUND', 'User not found')
    user = found
  } else if (emailInput) {
    const found = await prisma.user.findUnique({ where: { email: emailInput.toLowerCase() }, select: { id: true, email: true, name: true } })
    if (found) user = found
  }

  const email = (user?.email || emailInput || '').toLowerCase()
  const name: string = (nameInput || user?.name || email.split('@')[0]) ?? ''
  if (!email) throw new AdminError('VALIDATION_ERROR', 'Email required')

  const effectiveOfferId = offerId ?? process.env.KAJABI_OFFER_ID

  const result = await enrollUserInKajabi(email, name, { ...(effectiveOfferId !== undefined ? { offerId: effectiveOfferId } : {}) })

  if (user && result.success && result.contactId) {
    await prisma.user.update({ where: { id: user.id }, data: { kajabi_contact_id: String(result.contactId) } })
  }

  let offerIdResolved: string | number | undefined = effectiveOfferId
  let contactIdResolved: string | number | undefined = result.contactId
  try {
    if (effectiveOfferId !== undefined) {
      const clientId = process.env.KAJABI_API_KEY
      const clientSecret = process.env.KAJABI_CLIENT_SECRET
      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
        })
        const TokenSchema = z.object({ access_token: z.string().optional() })
        const tokenJsonUnknown: unknown = await tokenRes.json().catch(() => ({}))
        const tokenParsed = TokenSchema.safeParse(tokenJsonUnknown)
        const accessToken = tokenParsed.success ? tokenParsed.data.access_token : undefined
        if (accessToken) {
          const api = async (path: string, method = 'GET', body?: unknown) =>
            fetch(`https://api.kajabi.com/v1${path}`, {
              method,
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
              ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            })

          if (!contactIdResolved) {
            const list = await api('/contacts')
            const ContactsSchema = z.object({ data: z.array(z.object({ id: z.union([z.string(), z.number()]), attributes: z.object({ email: z.string().email().optional() }).partial() })).default([]) })
            const listJsonUnknown: unknown = await list.json().catch(() => ({}))
            const contactsParsed = ContactsSchema.safeParse(listJsonUnknown)
            if (contactsParsed.success) {
              const found = contactsParsed.data.data.find((c) => (c.attributes.email || '').toLowerCase() === email.toLowerCase())
              if (found) contactIdResolved = String(found.id)
            }
            if (!contactIdResolved) {
              const sites = await api('/sites')
              const SitesSchema = z.object({ data: z.array(z.object({ id: z.union([z.string(), z.number()]) })).default([]) })
              const siteJsonUnknown: unknown = await sites.json().catch(() => ({}))
              const sitesParsed = SitesSchema.safeParse(siteJsonUnknown)
              const siteId = sitesParsed.success && sitesParsed.data.data[0] ? String(sitesParsed.data.data[0].id) : undefined
              const [firstName, ...rest] = name.split(' ')
              const lastName = rest.join(' ')
              const crt = await api('/contacts', 'POST', { data: { type: 'contacts', attributes: { email, first_name: firstName, last_name: lastName }, ...(siteId ? { relationships: { site: { data: { type: 'sites', id: siteId } } } } : {}) } })
              const ContactCreateSchema = z.object({ data: z.object({ id: z.union([z.string(), z.number()]) }).optional() })
              const crtJsonUnknown: unknown = await crt.json().catch(() => ({}))
              const crtParsed = ContactCreateSchema.safeParse(crtJsonUnknown)
              if (crtParsed.success && crtParsed.data.data) contactIdResolved = String(crtParsed.data.data.id)
            }
          }

          if (typeof effectiveOfferId === 'string' && !/^\d+$/.test(effectiveOfferId)) {
            const off = await api('/offers')
            const OffersSchema = z.object({ data: z.array(z.object({ id: z.union([z.string(), z.number()]), attributes: z.object({ name: z.string().optional(), title: z.string().optional(), product_title: z.string().optional(), offer_title: z.string().optional(), product: z.object({ title: z.string().optional() }).partial().optional() }).partial() })).default([]) })
            const offJsonUnknown: unknown = await off.json().catch(() => ({}))
            const offersParsed = OffersSchema.safeParse(offJsonUnknown)
            if (offersParsed.success) {
              const match = offersParsed.data.data.find((o) => {
                const a = o.attributes || {}
                const candidates = [a.name, a.title, a.product_title, a.offer_title, a.product?.title].filter(Boolean) as string[]
                return candidates.some((v) => v.toLowerCase() === String(effectiveOfferId).toLowerCase())
              })
              if (match) offerIdResolved = String(match.id)
            }
          }

          if (contactIdResolved && offerIdResolved) {
            let rel = await api(`/contacts/${contactIdResolved}/relationships/offers`, 'POST', { data: [{ type: 'offers', id: String(offerIdResolved) }] })
            if (!rel.ok) {
              rel = await api(`/offers/${offerIdResolved}/relationships/contacts`, 'POST', { data: [{ type: 'contacts', id: String(contactIdResolved) }] })
            }
          }
        }
      }
    }
  } catch (e) {
    const logger = await getSafeServerLogger('admin-kajabi-invite')
    logger.warn('Kajabi v1 grant fallback failed', { error: e instanceof Error ? e.message : String(e) })
  }

  const meta: Prisma.InputJsonValue = {
    email,
    name,
    offer_id: effectiveOfferId ?? null,
    granted: !!effectiveOfferId && result.success,
    contact_id: result.contactId ?? null,
    error: result.error,
  }
  await prisma.auditLog.create({
    data: {
      actor_id: 'admin',
      action: result.success ? 'KAJABI_INVITE_SENT' : 'KAJABI_INVITE_FAILED',
      target_id: user?.id ?? email,
      meta,
    },
  })

  if (!result.success) throw new AdminError('INTEGRATION_FAILED', result.error || 'Kajabi invite failed')

  const contactIdFinal = result.contactId || (contactIdResolved ? Number(contactIdResolved) : undefined)
  const out = { invited: true, ...(contactIdFinal !== undefined ? { contactId: contactIdFinal } : {}), withOffer: !!effectiveOfferId, ...(offerIdResolved !== undefined ? { offerIdResolved } : {}) }
  const logger2 = await getSafeServerLogger('admin-kajabi')
  logger2.info('Invite Kajabi', { email, withOffer: !!effectiveOfferId, contactId: contactIdFinal })
  recordSLO('/admin/service/kajabi/invite', start, 200)
  return out
  } catch (err) {
    const logger = await getSafeServerLogger('admin-kajabi')
    logger.error('Invite Kajabi failed', { error: err instanceof Error ? err.message : String(err) })
    recordSLO('/admin/service/kajabi/invite', start, 500)
    throw new Error(handleApiError(err, 'Invite Kajabi failed'))
  }
}
