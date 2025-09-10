import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

vi.mock('@elevate/db', () => ({
  findUserById: vi.fn(async () => ({ id: 'u1', user_type: 'EDUCATOR' })),
  findActivityByCode: vi.fn(async (code: string) => ({ code, name: code, default_points: 10 })),
  findSubmissionsByUserAndActivity: vi.fn(async () => []),
  findSubmissionsWithFilters: vi.fn(async () => []),
  createSubmission: vi.fn(async () => ({
    id: 's-new',
    activity_code: 'PRESENT',
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

describe('POST /api/submissions (PRESENT success)', () => {
  beforeEach(() => vi.resetModules())

  it('accepts valid PRESENT payload and returns 201', async () => {
    const mod = await import('../app/api/submissions/route')
    const req = makeRequest({
      activityCode: 'PRESENT',
      payload: {
        linkedinUrl: 'https://linkedin.com/posts/abc',
        caption: 'A meaningful caption with enough length',
        screenshotUrl: 'evidence/present/u1/screen.png',
      },
      visibility: 'PRIVATE',
      attachments: [],
    })
    const res = await mod.POST(req, { traceId: 't' } as unknown as { traceId: string })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body?.success).toBe(true)
    expect(body?.data?.id).toBe('s-new')
  })
})

