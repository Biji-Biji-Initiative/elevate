import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'
import type { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

vi.mock('@elevate/db', () => ({
  findUserById: vi.fn(async () => ({ id: 'u1', user_type: 'EDUCATOR' })),
  findActivityByCode: vi.fn(async (code: string) => ({ code, name: code, default_points: 20 })),
  findSubmissionsByUserAndActivity: vi.fn(async () => []),
  findSubmissionsWithFilters: vi.fn(async () => []),
  createSubmission: vi.fn(async () => ({
    id: 's-explore',
    activity_code: 'EXPLORE',
    status: 'PENDING',
    visibility: 'PRIVATE',
    created_at: new Date().toISOString(),
  })),
  createSubmissionAttachment: vi.fn(async () => ({})),
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

describe('POST /api/submissions (EXPLORE success)', () => {
  beforeEach(() => vi.resetModules())

  it('accepts valid EXPLORE payload and returns 201', async () => {
    const mod = await import('../app/api/submissions/route')
    const req = makeRequest({
      activityCode: 'EXPLORE',
      payload: {
        reflection: 'A'.repeat(160),
        classDate: '2025-01-15',
        school: 'SDN 1',
        evidenceFiles: ['evidence/explore/u1/pic.jpg'],
      },
      visibility: 'PRIVATE',
    })
    const res = await mod.POST(req, { traceId: 't' } as unknown as { traceId: string })
    expect(res.status).toBe(201)
    const body = await readJson<{ success?: boolean; data?: { id?: string } }>(res)
    expect(body?.success).toBe(true)
    expect(body?.data?.id).toBe('s-explore')
  })
})
