/**
 * Kajabi E2E verification against deployed app APIs (no admin UI)
 *
 * Steps:
 * 1) Force enroll / grant offer via admin API (returns contactId)
 * 2) Send a signed Kajabi webhook (contact.tagged) with 'elevate-ai-1-completed'
 * 3) Report statuses so you can verify in Kajabi and app logs
 *
 * Env:
 *   BASE_URL=https://app.example.org
 *   ADMIN_TOKEN=<Clerk admin JWT>
 *   KAJABI_WEBHOOK_SECRET=<string>
 *   TEST_EMAIL=testuser@example.org
 *   TEST_NAME="Test User"
 *   KAJABI_OFFER_ID=r8LNCZ3f (optional)
 */

import crypto from 'node:crypto'

async function main() {
  const BASE_URL = process.env.BASE_URL || ''
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''
  const KAJABI_WEBHOOK_SECRET = process.env.KAJABI_WEBHOOK_SECRET || ''
  const TEST_EMAIL = process.env.TEST_EMAIL || ''
  const TEST_NAME = process.env.TEST_NAME || 'Test User'
  const KAJABI_OFFER_ID = process.env.KAJABI_OFFER_ID

  if (!BASE_URL || !ADMIN_TOKEN || !KAJABI_WEBHOOK_SECRET || !TEST_EMAIL) {
    console.error('Missing env. Required: BASE_URL, ADMIN_TOKEN, KAJABI_WEBHOOK_SECRET, TEST_EMAIL')
    process.exit(2)
  }

  // 1) Enroll via admin invite
  const inviteRes = await fetch(`${BASE_URL}/api/admin/kajabi/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ email: TEST_EMAIL, name: TEST_NAME, ...(KAJABI_OFFER_ID ? { offerId: KAJABI_OFFER_ID } : {}) }),
  })
  const inviteJson = await inviteRes.json().catch(() => ({}))
  console.log('Invite:', inviteRes.status, inviteJson)

  // 2) Send signed webhook for elevate-ai-1-completed
  const payload = {
    event_id: `manual_${Date.now()}`,
    event_type: 'contact.tagged' as const,
    created_at: new Date().toISOString(),
    contact: { id: 12345, email: TEST_EMAIL },
    tag: { name: 'elevate-ai-1-completed' },
  }
  const bodyText = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', KAJABI_WEBHOOK_SECRET).update(bodyText).digest('hex')
  const hookRes = await fetch(`${BASE_URL}/api/kajabi/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kajabi-signature': signature,
    },
    body: bodyText,
  })
  const hookJson = await hookRes.json().catch(() => ({}))
  console.log('Webhook:', hookRes.status, hookJson)

  // Done — you can confirm in Kajabi (contact + offer) and in app logs/DB for tag grant.
}

main().catch((e) => {
  console.error('E2E failed:', e)
  process.exit(1)
})

