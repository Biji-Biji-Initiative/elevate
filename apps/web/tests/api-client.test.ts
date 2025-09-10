import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getServerApiClient builds baseUrl from headers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses x-forwarded-proto/host when present', async () => {
    vi.mock('next/headers', () => ({
      headers: () => new Headers({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'example.com' }),
    }))
    const mod = await import('../lib/api-client')
    const client = await mod.getServerApiClient()
    type HasBaseUrl = { baseUrl?: string }
    const maybe = client as HasBaseUrl
    expect(maybe.baseUrl).toBe('https://example.com')
  })
})
