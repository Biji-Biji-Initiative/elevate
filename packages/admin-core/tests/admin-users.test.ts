import { describe, it, expect, vi, beforeEach } from 'vitest'

import { adminActions } from '../src/actions'

// Simple fetch mock helper
function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  }) as unknown as Response
  vi.stubGlobal('fetch', vi.fn(async () => res) as unknown as typeof fetch)
}

describe('admin-core: user detail actions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getUserById parses envelope', async () => {
    mockFetchOnce({ success: true, data: { user: { id: 'u1', email: 'u@example.com', user_type: 'EDUCATOR', user_type_confirmed: true, created_at: new Date().toISOString() } } })
    const out = await adminActions.getUserById('u1')
    expect(out.user.id).toBe('u1')
    expect(out.user.user_type).toBe('EDUCATOR')
  })

  it('updateUserById parses envelope', async () => {
    mockFetchOnce({ success: true, data: { user: { id: 'u1', email: 'u@example.com', user_type: 'STUDENT', user_type_confirmed: true, created_at: new Date().toISOString() } } })
    const out = await adminActions.updateUserById('u1', { userType: 'STUDENT', userTypeConfirmed: true })
    expect(out.user.user_type).toBe('STUDENT')
  })

  it('bulkUpdateLeapsUsers parses envelope', async () => {
    mockFetchOnce({ success: true, data: { processed: 2, failed: 0, errors: [] } })
    const out = await adminActions.bulkUpdateLeapsUsers({ userIds: ['u1', 'u2'], userType: 'EDUCATOR', userTypeConfirmed: true })
    expect(out.processed).toBe(2)
    expect(out.failed).toBe(0)
  })
})
