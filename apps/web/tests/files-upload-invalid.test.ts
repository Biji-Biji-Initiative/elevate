import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Mock auth to return a user
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
}))

// Mock storage to throw validation error
class FileValidationError extends Error {}
vi.mock('@elevate/storage', () => ({
  saveEvidenceFile: vi.fn(async () => { throw new FileValidationError('invalid') }),
  FileValidationError,
}))

function makeRequest(form: FormData): NextRequest {
  const url = new URL('http://localhost/api/files/upload')
  const req = new Request(url, {
    method: 'POST',
    body: form,
  })
  return Object.assign(req, { nextUrl: url }) as unknown as NextRequest
}

describe('POST /api/files/upload (invalid file)', () => {
  beforeEach(() => vi.resetModules())

  it('returns 400 when storage rejects invalid file', async () => {
    const form = new FormData()
    const file = new File([new TextEncoder().encode('bad')], 'bad.exe', { type: 'application/x-msdownload' })
    form.append('file', file)
    form.append('activityCode', 'LEARN')

    const mod = await import('../app/api/files/upload/route')
    const res = await mod.POST(makeRequest(form), { traceId: 't' } as unknown as { traceId: string })
    expect([400, 422]).toContain(res.status)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

