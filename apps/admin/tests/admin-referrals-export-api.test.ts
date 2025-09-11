import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@elevate/auth/server-helpers', async () => ({
  requireRole: vi.fn(async () => ({ userId: 'admin_1', role: 'admin' })),
}))

const findManyReferralsMock = vi.fn()
const findManyUsersMock = vi.fn()

vi.mock('@elevate/db', async () => ({
  prisma: {
    referralEvent: { findMany: findManyReferralsMock },
    user: { findMany: findManyUsersMock },
  },
}))

describe('Admin referrals export CSV', () => {
  beforeEach(() => {
    findManyReferralsMock.mockReset()
    findManyUsersMock.mockReset()
  })

  it('returns CSV headers and applies formula-injection hardening', async () => {
    const { GET } = await import('../app/api/admin/referrals/export.csv/route')

    // One page then done
    findManyReferralsMock
      .mockResolvedValueOnce([
        {
          created_at: new Date('2025-09-10T12:00:00Z'),
          event_type: 'signup',
          source: 'cookie',
          external_event_id: 'referral:signup:user_2',
          // Include relations with risky leading chars to ensure hardening
          referrer: { name: '=cmd', email: 'ref@x' },
          referee: { name: '+bob', email: 'bob@x', user_type: 'STUDENT' },
        },
      ])
      .mockResolvedValueOnce([])

    const req = new Request('http://localhost/api/admin/referrals/export.csv?month=2025-09')
    const res = await GET(req as unknown as import('next/server').NextRequest)
    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('when,event,source,referrer_name,referrer_email,referee_name,referee_email,referee_type,external_event_id')
    // Both suspicious names should be prefixed with a single quote
    expect(text).toContain("'" + '=cmd')
    expect(text).toContain("'" + '+bob')
  })
})

