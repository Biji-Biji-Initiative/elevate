import { describe, it, expect, vi, beforeEach } from 'vitest'

import { AdminApiClient } from '../src/api-client'

describe('AdminApiClient getAdminUsers includes userType', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('appends userType to query string', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(JSON.stringify({ success: true, data: { users: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }) as unknown as Response,
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const api = new AdminApiClient({ baseUrl: 'http://localhost:3000' })
    const params = { userType: 'EDUCATOR' } as unknown as Parameters<typeof api.getAdminUsers>[0]
    await api.getAdminUsers(params)
    const calledUrl = (fetchMock.mock.calls[0]?.[0] as string) || ''
    expect(calledUrl).toContain('/api/admin/users')
    expect(calledUrl).toContain('userType=EDUCATOR')
  })
})
