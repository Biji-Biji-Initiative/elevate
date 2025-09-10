/**
 * Send a signed Kajabi webhook (contact.tagged) to the app.
 * Env:
 *   BASE_URL
 *   KAJABI_WEBHOOK_SECRET
 *   EMAIL
 *   TAG (default: elevate-ai-1-completed)
 */
import crypto from 'node:crypto'

async function main() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
  const SECRET = process.env.KAJABI_WEBHOOK_SECRET || ''
  const EMAIL = process.env.EMAIL || ''
  const TAG = (process.env.TAG || 'elevate-ai-1-completed').toLowerCase()
  if (!SECRET || !EMAIL) {
    console.error('Missing env. Required: KAJABI_WEBHOOK_SECRET, EMAIL')
    process.exit(2)
  }
  const payload = {
    event_id: `manual_${Date.now()}`,
    event_type: 'contact.tagged' as const,
    created_at: new Date().toISOString(),
    contact: { id: 12345, email: EMAIL },
    tag: { name: TAG },
  }
  const bodyText = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', SECRET).update(bodyText).digest('hex')
  const res = await fetch(`${BASE_URL}/api/kajabi/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-kajabi-signature': signature },
    body: bodyText,
  })
  const text = await res.text()
  console.log('Webhook status:', res.status)
  console.log('Response:', text)
}

main().catch((e) => { console.error(e); process.exit(1) })

