import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('admin getServerApiClient builds baseUrl from headers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses x-forwarded-proto/host when present', async () => {
    vi.mock('next/headers', () => ({
      headers: () => new Headers({ 'x-forwarded-proto': 'http', 'x-forwarded-host': 'admin.example.local:4000' }),
    }))
    const mod = await import('../lib/api-client')
    const client = await mod.getServerApiClient()
    // Use the explicit helper to avoid `any` casts
    expect(mod.__debugGetBaseUrl(client)).toBe('http://admin.example.local:4000')
  })
})
