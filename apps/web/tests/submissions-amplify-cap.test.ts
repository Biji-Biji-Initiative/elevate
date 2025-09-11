import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readJson } from './test-utils'
import type { NextRequest } from 'next/server'

// Mock auth to return a user
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

// Mock database functions used by the submissions route
vi.mock('@elevate/db', () => ({
  findUserById: vi.fn(async () => ({ id: 'u1', user_type: 'EDUCATOR' })),
  findActivityByCode: vi.fn(async (code: string) => ({ code, name: code })),
  findSubmissionsByUserAndActivity: vi.fn(async () => []),
  findSubmissionsWithFilters: vi.fn(async () => ([
    { id: 's1', payload: { peers_trained: 50, students_trained: 200 } },
  ])),
  createSubmission: vi.fn(),
  createSubmissionAttachment: vi.fn(),
}))

function makeRequest(body: unknown): NextRequest {
  const url = new URL('http://localhost/api/submissions')
  const req = new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  // NextRequest shape subset
  return Object.assign(req, { nextUrl: url }) as unknown as NextRequest
}

describe('POST /api/submissions (AMPLIFY caps)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('rejects when 7-day peers/students caps exceeded', async () => {
    const mod = await import('../app/api/submissions/route')
    const req = makeRequest({
      activityCode: 'AMPLIFY',
      visibility: 'PUBLIC',
      payload: { peersTrained: 10, studentsTrained: 10 },
    })
    const res = await mod.POST(req, { traceId: 't' } as unknown as { traceId: string })
    expect(res.status).toBe(400)
    const body = await readJson<{ success?: boolean }>(res)
    expect(body?.success).toBe(false)
  })
})
