/**
 * Kajabi v1 API test: OAuth, create/update contact, grant offer.
 *
 * Env:
 *   KAJABI_API_KEY
 *   KAJABI_CLIENT_SECRET
 *   TEST_EMAIL
 *   TEST_NAME
 *   KAJABI_OFFER_ID (optional)
 */

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OAuth token error ${res.status}: ${txt}`)
  }
  const json = (await res.json()) as { access_token: string }
  if (!json?.access_token) throw new Error('No access token returned')
  return json.access_token
}

async function apiCall(path: string, token: string, method = 'GET', body?: unknown) {
  const res = await fetch(`https://api.kajabi.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: unknown = undefined
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, ok: res.ok, json, text }
}

async function main() {
  const clientId = process.env.KAJABI_API_KEY || ''
  const clientSecret = process.env.KAJABI_CLIENT_SECRET || ''
  const email = (process.env.TEST_EMAIL || '').toLowerCase().trim()
  const fullName = process.env.TEST_NAME || 'Test User'
  const offerIdEnv = process.env.KAJABI_OFFER_ID || ''
  const offerNameEnv = process.env.OFFER_NAME || ''
  if (!clientId || !clientSecret || !email) {
    console.error('Missing env. Required: KAJABI_API_KEY, KAJABI_CLIENT_SECRET, TEST_EMAIL')
    process.exit(2)
  }
  const [firstName, ...rest] = fullName.split(' ')
  const lastName = rest.join(' ')

  console.log('▶️  Getting OAuth token...')
  const token = await getAccessToken(clientId, clientSecret)
  console.log('   Token acquired')

  console.log('▶️  Fetching site id...')
  const sites = await apiCall('/sites', token)
  const siteId = Array.isArray((sites.json as any)?.data) ? (sites.json as any).data[0]?.id : undefined
  console.log('   site id:', siteId || 'unknown')

  console.log('▶️  Listing contacts (first page)...')
  let list = await apiCall('/contacts', token)
  console.log('   contacts status:', list.status)

  // Find by email from the list (simple baseline)
  const existing = Array.isArray((list.json as any)?.data)
    ? (list.json as any).data.find((c: any) => c?.attributes?.email?.toLowerCase() === email)
    : null

  let contactId = existing?.id as string | undefined
  if (contactId) {
    console.log('   Existing contact found:', contactId)
  } else {
    console.log('▶️  Creating contact...')
    const createBody = {
      data: {
        type: 'contacts',
        attributes: { email, first_name: firstName, last_name: lastName },
        ...(siteId ? {
          relationships: {
            site: { data: { type: 'sites', id: siteId } },
          },
        } : {}),
      },
    }
    let crt = await apiCall('/contacts', token, 'POST', createBody)
    console.log('   create status:', crt.status)
    if (!crt.ok) {
      // Try to look up by filter[email]
      list = await apiCall(`/contacts?filter[email]=${encodeURIComponent(email)}`, token)
      const found = Array.isArray((list.json as any)?.data)
        ? (list.json as any).data.find((c: any) => c?.attributes?.email?.toLowerCase() === email)
        : null
      contactId = found?.id
      if (!contactId) {
        console.error('   create error:', crt.text)
        process.exit(3)
      }
      console.log('   Existing contact id (via filter):', contactId)
    } else {
      contactId = (crt.json as any)?.data?.id
      console.log('   New contact id:', contactId)
    }
  }

  // Resolve offer id: use numeric id from env if provided, else try to find by name
  let offerId: string | undefined = offerIdEnv || undefined
  if (!offerId && offerNameEnv) {
    console.log('▶️  Resolving offer id by name:', offerNameEnv)
    const off = await apiCall('/offers', token)
    if (off.ok && Array.isArray((off.json as any)?.data)) {
      const data = (off.json as any).data
      // Try to match across common attribute keys
      const match = data.find((o: any) => {
        const a = o?.attributes || {}
        const candidates = [a.name, a.title, a.product_title, a.product?.title, a.offer_title]
        return candidates.some((v: any) => typeof v === 'string' && v.toLowerCase() === offerNameEnv.toLowerCase())
      })
      if (match?.id) {
        offerId = match.id
        console.log('   Resolved offer id:', offerId)
      } else {
        console.log('   Could not resolve by name; printing first 5 offers for inspection...')
        console.log(
          data.slice(0, 5).map((o: any) => ({ id: o.id, attrs: o.attributes }))
        )
      }
    } else {
      console.warn('   Failed to list offers:', off.status)
    }
  }

  if (offerId && contactId) {
    console.log('▶️  Granting offer via contacts→offers...')
    let rel = await apiCall(`/contacts/${contactId}/relationships/offers`, token, 'POST', {
      data: [ { type: 'offers', id: offerId } ],
    })
    console.log('   grant status (contacts→offers):', rel.status)
      if (!rel.ok) {
        console.warn('   response:', rel.text)
        console.log('▶️  Listing offers to help resolve numeric IDs...')
        const off = await apiCall('/offers', token)
        console.log('   offers status:', off.status)
        if (off.ok) {
          const data = (off.json as any)?.data || []
          console.log('   offers:', data.slice(0, 5).map((o: any) => ({ id: o.id, name: o.attributes?.name })) )
        }
        console.log('▶️  Fallback: offers→contacts...')
      rel = await apiCall(`/offers/${offerId}/relationships/contacts`, token, 'POST', {
        data: [ { type: 'contacts', id: contactId } ],
      })
      console.log('   grant status (offers→contacts):', rel.status)
      if (!rel.ok) {
        console.warn('   response:', rel.text)
      }
    }
  } else if (!offerIdEnv && offerNameEnv) {
    console.warn('⚠️ Offer name was provided but could not be resolved to an id. Please check offer listings output.')
  }

  console.log('✅ Done')
}

main().catch((e) => {
  console.error('E2E failed:', e)
  process.exit(1)
})
