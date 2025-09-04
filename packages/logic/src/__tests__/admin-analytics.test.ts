import { describe, it, expect } from 'vitest'
import { computeDailySubmissionStats, mapPointsDistributionFromUserTotals, mapReviewerPerformance } from '../admin-analytics'

describe('admin-analytics helpers', () => {
  it('computeDailySubmissionStats groups by date and status', () => {
    const now = new Date('2025-01-01T12:00:00Z')
    const earlier = new Date('2024-12-31T08:00:00Z')
    const input = [
      { created_at: now, status: 'APPROVED' },
      { created_at: now, status: 'PENDING' },
      { created_at: earlier, status: 'REJECTED' },
    ]
    const out = computeDailySubmissionStats(input)
    expect(out.find(d => d.date === '2025-01-01')?.approved).toBe(1)
    expect(out.find(d => d.date === '2025-01-01')?.pending).toBe(1)
    expect(out.find(d => d.date === '2024-12-31')?.rejected).toBe(1)
  })

  it('mapPointsDistributionFromUserTotals computes percentiles and averages', () => {
    const totals = [100, 50, 25, 10]
    const out = mapPointsDistributionFromUserTotals(totals)
    expect(out.totalUsers).toBe(4)
    expect(out.max).toBe(100)
    expect(out.min).toBe(10)
    expect(out.avg).toBeCloseTo(46.25, 2)
  })

  it('mapReviewerPerformance aggregates approved/rejected counts', () => {
    const reviewers = [
      { id: 'r1', name: 'R', handle: 'r', role: 'REVIEWER' },
    ]
    const perf = [
      { reviewer_id: 'r1', status: 'APPROVED', _count: 3 },
      { reviewer_id: 'r1', status: 'REJECTED', _count: 1 },
    ]
    const out = mapReviewerPerformance(reviewers, perf)
    expect(out[0].approved).toBe(3)
    expect(out[0].rejected).toBe(1)
    expect(out[0].total).toBe(4)
  })
})
