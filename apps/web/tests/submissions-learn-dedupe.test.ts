import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

// Mock db finder helpers minimal
vi.mock('@elevate/db', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    findUserById: vi.fn(async () => ({ id: 'u1', user_type: 'EDUCATOR' })),
    findActivityByCode: vi.fn(async (code: string) => ({ code, name: code, default_points: 20 })),
    findSubmissionsByUserAndActivity: vi.fn(async () => []),
    createSubmission: vi.fn(),
    createSubmissionAttachment: vi.fn(),
  }
})

vi.mock('@elevate/db/client', () => {
  return {
    prisma: {
      $queryRaw: vi.fn(async () => [{ count: BigInt(1) }]),
    },
  }
})

function makeRequest(body: unknown): NextRequest {
  const url = new URL('http://localhost/api/submissions')
  const req = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  return Object.assign(req, { nextUrl: url }) as unknown as NextRequest
}

describe('POST /api/submissions (LEARN certificate dedupe)', () => {
  beforeEach(() => vi.resetModules())

  it('rejects duplicate LEARN when certificate_hash matches', async () => {
    const mod = await import('../app/api/submissions/route')
    const req = makeRequest({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: 'AI for Educators',
        completedAt: new Date().toISOString(),
        certificateUrl: 'evidence/learn/u1/cert.pdf',
        certificateHash: 'abc123',
      },
    })
    const res = await mod.POST(req, { traceId: 't' } as unknown as { traceId: string })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body?.success).toBe(false)
  })
})

