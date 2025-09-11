import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'
import type { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

vi.mock('@elevate/db', () => ({
  findUserById: vi.fn(async () => ({ id: 'u1', user_type: 'EDUCATOR' })),
  findActivityByCode: vi.fn(async (code: string) => ({ code, name: code })),
  findSubmissionsByUserAndActivity: vi.fn(async () => ([{ id: 's1', status: 'PENDING' }])),
}))

function makeRequest(body: unknown): NextRequest {
  const url = new URL('http://localhost/api/submissions')
  const req = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  return Object.assign(req, { nextUrl: url }) as unknown as NextRequest
}

describe('POST /api/submissions (LEARN duplicate)', () => {
  beforeEach(() => vi.resetModules())

  it('rejects duplicate LEARN submission when existing pending/approved found', async () => {
    const mod = await import('../app/api/submissions/route')
    const req = makeRequest({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: 'AI for Educators',
        completedAt: new Date().toISOString(),
      },
      visibility: 'PRIVATE',
    })
    const res = await mod.POST(req, { traceId: 't' } as unknown as { traceId: string })
    expect(res.status).toBe(400)
    const body = await readJson<{ success?: boolean }>(res)
    expect(body?.success).toBe(false)
  })
})
