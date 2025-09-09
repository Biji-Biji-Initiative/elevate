import { describe, it, expect, vi, beforeEach } from 'vitest'

const learnTagGrantGroupBy = vi.fn()
const submissionFindMany = vi.fn()
const submissionCount = vi.fn()
const learnTagGrantCount = vi.fn()

vi.mock('@elevate/db/client', () => ({
  prisma: {
    learnTagGrant: { groupBy: learnTagGrantGroupBy, count: learnTagGrantCount },
    submission: { findMany: submissionFindMany, count: submissionCount },
  },
}))


describe('stats route', () => {
  beforeEach(() => {
    learnTagGrantGroupBy.mockReset()
    submissionFindMany.mockReset()
    submissionCount.mockReset()
    learnTagGrantCount.mockReset()
  })

  it('derives counters with EDUCATOR filter', async () => {
    learnTagGrantGroupBy.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }])
    submissionFindMany.mockResolvedValue([
      { payload: { peers_trained: 2, students_trained: 3, session_date: '2024-01-01' } },
      { payload: { peers_trained: 1, students_trained: 0, session_date: '2024-01-02' } },
    ])
    submissionCount.mockResolvedValue(5)
    learnTagGrantCount.mockResolvedValue(4)

    const { GET } = await import('../app/api/stats/route')
    const res = await GET(new Request('http://localhost/api/stats'))
    expect(res.status).toBe(200)
    expect(learnTagGrantGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['user_id'],
        where: { user: { user_type: 'EDUCATOR' } },
      }),
    )
    expect(submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { user_type: 'EDUCATOR' } }),
      }),
    )
    expect(submissionCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { user_type: 'EDUCATOR' } }),
      }),
    )
    expect(learnTagGrantCount).toHaveBeenCalledWith({
      where: { user: { user_type: 'EDUCATOR' } },
    })
    const json = await res.json()
    expect(json.data.counters).toEqual({
      educators_learning: 2,
      peers_students_reached: 6,
      stories_shared: 5,
      micro_credentials: 4,
      mce_certified: 0,
    })
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=1800, stale-while-revalidate=60',
    )
  })
})
