/**
 * Staging validation helper
 *
 * Run with:
 *   pnpm -C elevate tsx scripts/qa/validate-staging.ts
 *
 * Env:
 *   BASE_URL=https://staging.example.org
 *   ADMIN_TOKEN=...                    # Optional (Clerk JWT for admin)
 *   INTERNAL_METRICS_TOKEN=...         # Optional (for /api/slo)
 *   CRON_SECRET=...                    # Optional (to probe cron route with 401/200)
 */

type CheckResult = {
  name: string
  url: string
  status: number | 'SKIPPED' | 'ERROR'
  ok: boolean
  note?: string
}

async function safeFetch(
  url: string,
  init?: RequestInit,
  parseJson = true,
): Promise<{ status: number; ok: boolean; body?: unknown; error?: string }>
{
  try {
    const res = await fetch(url, init)
    const status = res.status
    const ok = res.ok
    const body = parseJson ? await res.json().catch(() => undefined) : undefined
    return { status, ok, body }
  } catch (e) {
    return { status: 0, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  const BASE_URL = process.env.BASE_URL || ''
  if (!BASE_URL) {
    console.error('❌ BASE_URL is required')
    process.exit(2)
  }
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN
  const INTERNAL_METRICS_TOKEN = process.env.INTERNAL_METRICS_TOKEN
  const CRON_SECRET = process.env.CRON_SECRET

  const results: CheckResult[] = []

  // Public endpoints
  for (const [name, path] of [
    ['health', '/api/health'],
    ['stats', '/api/stats'],
    ['leaderboard', '/api/leaderboard'],
  ] as const) {
    const { status, ok } = await safeFetch(`${BASE_URL}${path}`)
    results.push({ name, url: path, status, ok })
  }

  // Internal SLO
  if (INTERNAL_METRICS_TOKEN) {
    const { status, ok } = await safeFetch(`${BASE_URL}/api/slo`, {
      headers: { Authorization: `Bearer ${INTERNAL_METRICS_TOKEN}` },
    })
    results.push({ name: 'slo.summary', url: '/api/slo', status, ok })
  } else {
    results.push({ name: 'slo.summary', url: '/api/slo', status: 'SKIPPED', ok: false, note: 'INTERNAL_METRICS_TOKEN not set' })
  }

  // Admin endpoints (require ADMIN_TOKEN)
  if (ADMIN_TOKEN) {
    const adminHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` }
    const kajabiHealth = await safeFetch(`${BASE_URL}/api/admin/kajabi/health`, { headers: adminHeaders })
    results.push({ name: 'admin.kajabi.health', url: '/api/admin/kajabi/health', status: kajabiHealth.status, ok: kajabiHealth.ok })

    const sloSummary = await safeFetch(`${BASE_URL}/api/admin/slo/summary`, { headers: adminHeaders })
    results.push({ name: 'admin.slo.summary', url: '/api/admin/slo/summary', status: sloSummary.status, ok: sloSummary.ok })
  } else {
    results.push({ name: 'admin.kajabi.health', url: '/api/admin/kajabi/health', status: 'SKIPPED', ok: false, note: 'ADMIN_TOKEN not set' })
    results.push({ name: 'admin.slo.summary', url: '/api/admin/slo/summary', status: 'SKIPPED', ok: false, note: 'ADMIN_TOKEN not set' })
  }

  // Cron probe (401 expected without secret; 200 with secret)
  {
    const headers: Record<string, string> = {}
    let note = 'no secret'
    if (CRON_SECRET) {
      headers.Authorization = `Bearer ${CRON_SECRET}`
      note = 'with secret'
    }
    const cron = await safeFetch(
      `${BASE_URL}/api/cron/enforce-retention?days=730&limit=1&offset=999999`,
      { headers },
    )
    results.push({ name: 'cron.enforce-retention', url: '/api/cron/enforce-retention', status: cron.status, ok: cron.ok, note })
  }

  // Print human-readable summary
  const summary = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name} (${r.url}) — ${r.status}${r.note ? ` — ${r.note}` : ''}`).join('\n')
  console.log(summary)

  // Also print JSON
  console.log('\nJSON Summary:')
  console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2))

  // Exit non-zero if any required public endpoints failed
  const critical = results.filter((r) => ['health', 'stats', 'leaderboard'].includes(r.name) && !r.ok)
  process.exit(critical.length > 0 ? 1 : 0)
}

// Node 18+ fetch is global
void main()
