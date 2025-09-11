/**
 * Admin Smoke Test
 *
 * Validates admin endpoints: users list, user detail, bulk LEAPS update, audit logs.
 *
 * Env:
 *   BASE_URL=https://admin.example.org
 *   ADMIN_TOKEN=<Clerk admin JWT>
 *   TEST_USER_ID=<optional user id to target>
 */

async function main() {
  const BASE_URL = process.env.BASE_URL || ''
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''
  const TEST_USER_ID = process.env.TEST_USER_ID || ''
  if (!BASE_URL || !ADMIN_TOKEN) {
    console.error('Missing env: BASE_URL, ADMIN_TOKEN')
    process.exit(2)
  }
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${ADMIN_TOKEN}` }

  // 1) Users list
  const usersRes = await fetch(`${BASE_URL}/api/admin/users?limit=5`, { headers })
  const usersJson = await usersRes.json().catch(() => ({}))
  console.log('Users list:', usersRes.status, usersJson?.data?.pagination)
  const firstUserId = TEST_USER_ID || usersJson?.data?.users?.[0]?.id

  if (firstUserId) {
    // 2) User detail
    const userRes = await fetch(`${BASE_URL}/api/admin/users/${encodeURIComponent(firstUserId)}`, { headers })
    const userJson = await userRes.json().catch(() => ({}))
    console.log('User detail:', userRes.status, { id: userJson?.data?.user?.id, user_type: userJson?.data?.user?.user_type })

    // 3) Bulk LEAPS toggle confirm to true (single id)
    const bulkBody = { userIds: [firstUserId], userTypeConfirmed: true }
    const leapsRes = await fetch(`${BASE_URL}/api/admin/users/leaps`, { method: 'POST', headers, body: JSON.stringify(bulkBody) })
    const leapsJson = await leapsRes.json().catch(() => ({}))
    console.log('Bulk LEAPS:', leapsRes.status, leapsJson?.data)

    // 4) Audit logs for target
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit?targetId=${encodeURIComponent(firstUserId)}&limit=5`, { headers })
    const auditJson = await auditRes.json().catch(() => ({}))
    console.log('Audit logs:', auditRes.status, auditJson?.data?.logs?.length)
  } else {
    console.warn('No user id available to exercise detail/leaps/audit steps.')
  }
}

main().catch((e) => { console.error('Admin smoke failed:', e); process.exit(1) })

