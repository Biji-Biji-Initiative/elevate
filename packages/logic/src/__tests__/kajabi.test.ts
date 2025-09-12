import { describe, it, expect } from 'vitest'

import { processKajabiWebhook, computeExternalEventId } from '../kajabi'
import { createTxMock } from './tx-mock.test'

describe('processKajabiWebhook', () => {
  it('returns tag_not_processed when tag is not allowed', async () => {
    const tx = createTxMock()
    const event = {
      event_id: 'e1',
      event_type: 'contact.tagged' as const,
      contact: { id: 1, email: 'u@example.com' },
      tag: { name: 'OTHER_TAG' },
    }
    const res = await processKajabiWebhook(tx, event, new Date(), { allowedTags: new Set(['learn_completed']) })
    expect(res.success).toBe(true)
    expect(res.reason).toBe('tag_not_processed')
  })

  it('returns user_not_found when no matching user', async () => {
    const tx = createTxMock()
    const event = {
      event_id: 'e2',
      event_type: 'contact.tagged' as const,
      contact: { id: 123, email: 'missing@example.com' },
      tag: { name: 'LEARN_COMPLETED' },
    }
    const res = await processKajabiWebhook(tx, event, new Date(), { allowedTags: new Set(['learn_completed']) })
    expect(res.success).toBe(false)
    expect(res.reason).toBe('user_not_found')
  })

  it('grants points and links user on first webhook, then idempotent', async () => {
    const tx: any = createTxMock()
    tx.addUser({ id: 'u1', email: 'learner@example.com', kajabi_contact_id: null })

    const eventTime = new Date('2024-02-01T10:00:00Z')
    const event = {
      event_id: 'kajabi_abc_123',
      event_type: 'contact.tagged' as const,
      contact: { id: 555, email: 'learner@example.com' },
      tag: { name: 'LEARN_COMPLETED' },
    }

    // First run
    const res1 = await processKajabiWebhook(tx, event, eventTime, { allowedTags: new Set(['learn_completed']) })
    expect(res1.success).toBe(true)
    expect(res1.userId).toBe('u1')
    expect(res1.pointsAwarded).toBeGreaterThan(0)

    // Duplicate
    const res2 = await processKajabiWebhook(tx, event, eventTime, { allowedTags: new Set(['learn_completed']) })
    expect(res2.success).toBe(true)
    expect(res2.reason).toBe('already_processed')
  })

  it('computes deterministic external id when missing event_id', () => {
    const event = {
      event_type: 'contact.tagged' as const,
      contact: { id: 777, email: 'x@y.z' },
      tag: { name: 'LEARN_COMPLETED' },
    }
    const id1 = computeExternalEventId(event as any, new Date('2024-01-01T00:00:00Z'))
    const id2 = computeExternalEventId(event as any, new Date('2024-01-01T00:00:00Z'))
    expect(id1).toBe(id2)
  })
})
