import type { Prisma } from '@elevate/db'
import { activityCanon } from '@elevate/types/activity-canon'
import type { KajabiTagEvent } from '@elevate/types/webhooks'


export interface ProcessKajabiOptions {
  allowedTags: Set<string>
}

export interface KajabiProcessResult {
  success: boolean
  reason?: 'already_processed' | 'tag_not_processed' | 'user_not_found' | 'student' | 'granted'
  userId?: string
  pointsAwarded?: number
  kajabiContactId?: string
}

export function computeExternalEventId(event: KajabiTagEvent, eventTime: Date): string {
  if (event.event_id && event.event_id.length > 0) return event.event_id
  // Deterministic fallback to ensure idempotency even without event_id
  const source = `${String(event.contact.id)}:${event.tag.name}:${eventTime.toISOString()}`
  // Lightweight hash to avoid crypto dependency here; DB uniqueness still enforced
  let h = 0
  for (let i = 0; i < source.length; i++) {
    h = (h * 31 + source.charCodeAt(i)) >>> 0
  }
  return `kajabi_${h.toString(16)}`
}

export async function processKajabiWebhook(
  tx: Prisma.TransactionClient,
  event: KajabiTagEvent,
  eventTime: Date,
  opts: ProcessKajabiOptions,
): Promise<KajabiProcessResult> {
  const tagNorm = event.tag.name.toLowerCase().trim()
  if (!opts.allowedTags.has(tagNorm)) {
    return { success: true, reason: 'tag_not_processed' }
  }

  const contactId = String(event.contact.id)
  const email = String(event.contact.email || '').toLowerCase().trim() || undefined
  const externalEventId = computeExternalEventId(event, eventTime)

  // Match user by kajabi_contact_id, else by email
  let user = await tx.user.findUnique({ where: { kajabi_contact_id: contactId } })
  if (!user && email) {
    user = await tx.user.findUnique({ where: { email } })
    if (user && !user.kajabi_contact_id) {
      // Attempt to link Kajabi contact ID; if concurrent, fall back to the existing owner
      try {
        await tx.user.update({ where: { id: user.id }, data: { kajabi_contact_id: contactId } })
      } catch {
        const existing = await tx.user.findUnique({ where: { kajabi_contact_id: contactId } })
        if (existing) user = existing
      }
    }
  }

  if (!user) {
    return { success: false, reason: 'user_not_found' }
  }

  // Grant tag record idempotently
  try {
    await tx.learnTagGrant.create({ data: { user_id: user.id, tag_name: tagNorm, granted_at: eventTime } })
  } catch {
    // ignore unique violations
  }

  // Idempotent points award
  const existing = await tx.pointsLedger.findUnique({ where: { external_event_id: externalEventId } })
  if (existing) {
    return { success: true, reason: 'already_processed', userId: user.id, kajabiContactId: contactId }
  }

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

  // Minimal audit trail (submissions + audit logs can be added by caller as needed)
  await tx.submission.create({
    data: {
      user_id: user.id,
      activity_code: 'LEARN',
      status: 'APPROVED' as any,
      visibility: 'PRIVATE' as any,
      payload: {
        tag_name: event.tag.name,
        kajabi_contact_id: Number.isNaN(Number(contactId)) ? contactId : Number(contactId),
        provider: 'Kajabi',
        auto_approved: true,
        source: 'tag_webhook',
      },
    },
  })

  return { success: true, reason: 'granted', userId: user.id, kajabiContactId: contactId, pointsAwarded: activityCanon.learn.perTag }
}

