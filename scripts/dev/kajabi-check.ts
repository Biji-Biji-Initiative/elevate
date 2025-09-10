#!/usr/bin/env -S node --no-warnings
// tsx compatible script to validate Kajabi contact enrollment without importing workspace packages
// Usage:
//   KAJABI_API_KEY=... KAJABI_CLIENT_SECRET=... pnpm -C elevate tsx scripts/dev/kajabi-check.ts <email> "<name>" [offerId]

import axios from 'axios'

async function main() {
  const [emailArg, nameArg, offerIdArg] = process.argv.slice(2)
  if (!emailArg) {
    console.error('Email is required: tsx scripts/dev/kajabi-check.ts <email> "<name>" [offerId]')
    process.exit(1)
  }
  const email = String(emailArg).toLowerCase().trim()
  const name = nameArg ? String(nameArg) : 'Test User'
  const offerId = offerIdArg && offerIdArg.length > 0 ? offerIdArg : undefined

  const key = process.env.KAJABI_API_KEY
  const secret = process.env.KAJABI_CLIENT_SECRET
  if (!key || !secret) {
    console.error('KAJABI_API_KEY and KAJABI_CLIENT_SECRET must be set as env vars')
    process.exit(1)
  }

  const client = axios.create({
    baseURL: 'https://api.kajabi.com',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Kajabi-Client-Secret': secret,
    },
  })

  console.log('▶️  Checking Kajabi connectivity…')
  try {
    const hc = await client.get('/contacts?limit=1')
    console.log('   Kajabi health:', hc.status === 200 ? 'OK' : hc.status)
  } catch {
    console.log('   Kajabi health: FAILED')
  }

  console.log(`▶️  Ensuring contact for ${email}…`)
  // Find existing
  let contactId: number | null = null
  try {
    const resp = await client.get(`/contacts?email=${encodeURIComponent(email)}`)
    const first = Array.isArray(resp.data?.contacts) ? resp.data.contacts[0] : null
    if (first && typeof first.id === 'number') contactId = first.id
  } catch {}

  // Create or update
  const [firstName, ...rest] = name.trim().split(' ')
  const lastName = rest.join(' ')
  if (contactId) {
    const upd = await client.put(`/contacts/${contactId}`, {
      contact: { email, first_name: firstName, last_name: lastName },
    })
    contactId = upd.data?.contact?.id ?? contactId
  } else {
    const crt = await client.post('/contacts', {
      contact: { email, first_name: firstName, last_name: lastName },
    })
    contactId = crt.data?.contact?.id ?? null
  }

  console.log('   Contact ID:', contactId)
  if (!contactId) {
    console.error('   Failed to create or update contact')
    process.exit(2)
  }

  if (offerId) {
    console.log(`▶️  Granting offer ${offerId} to contact ${contactId}…`)
    const grant = await client.post(`/contacts/${contactId}/offers/${offerId}/grant`)
    console.log('   Offer grant status:', grant.status)
  }

  console.log('✅ Kajabi enrollment test complete')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
