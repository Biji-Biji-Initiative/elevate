import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeEducatorOnlyRedirect, fetchMeProfile } from '../lib/educator-guard'

describe('computeEducatorOnlyRedirect', () => {
  it('returns /educators-only for students', () => {
    expect(computeEducatorOnlyRedirect({ userType: 'STUDENT', userTypeConfirmed: false })).toBe('/educators-only')
    expect(computeEducatorOnlyRedirect({ userType: 'STUDENT', userTypeConfirmed: true })).toBe('/educators-only')
  })

  it('returns /onboarding/user-type for unconfirmed educators', () => {
    expect(computeEducatorOnlyRedirect({ userType: 'EDUCATOR', userTypeConfirmed: false })).toBe('/onboarding/user-type')
  })

  it('returns null for confirmed educators', () => {
    expect(computeEducatorOnlyRedirect({ userType: 'EDUCATOR', userTypeConfirmed: true })).toBeNull()
  })

  it('returns null for missing profile', () => {
    expect(computeEducatorOnlyRedirect(null)).toBeNull()
    // @ts-expect-error test invalid shape
    expect(computeEducatorOnlyRedirect('x')).toBeNull()
  })
})

describe('fetchMeProfile', () => {
  afterEach(() => {
    // @ts-expect-error restore
    global.fetch = undefined
  })

  it('returns parsed profile when 200 OK', async () => {
    const mockJson = vi.fn(async () => ({ data: { userType: 'EDUCATOR', userTypeConfirmed: true } }))
    // @ts-expect-error assign
    global.fetch = vi.fn(async () => ({ ok: true, json: mockJson }))
    const me = await fetchMeProfile()
    expect(me).toEqual({ userType: 'EDUCATOR', userTypeConfirmed: true })
  })

  it('returns null when response not ok', async () => {
    // @ts-expect-error assign
    global.fetch = vi.fn(async () => ({ ok: false }))
    const me = await fetchMeProfile()
    expect(me).toBeNull()
  })

  it('returns null when json parsing fails', async () => {
    const mockJson = vi.fn(async () => { throw new Error('bad json') })
    // @ts-expect-error assign
    global.fetch = vi.fn(async () => ({ ok: true, json: mockJson }))
    const me = await fetchMeProfile()
    expect(me).toBeNull()
  })
})
