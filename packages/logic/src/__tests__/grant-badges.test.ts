import { describe, it, expect, vi } from 'vitest'
import { grantBadgesForUser } from '../scoring'

describe('grantBadgesForUser', () => {
  it('grants Starter when both tags exist', async () => {
    const tx = {
      earnedBadge: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learnTagGrant: {
        findMany: vi.fn().mockResolvedValue([
          { tag_name: 'elevate-ai-1-completed' },
          { tag_name: 'elevate-ai-2-completed' },
        ]),
      },
      submission: {
        count: vi.fn().mockResolvedValue(0),
      },
    }

    await grantBadgesForUser(tx as any, 'u1')

    expect(tx.earnedBadge.createMany).toHaveBeenCalledTimes(1)
    expect(tx.earnedBadge.createMany).toHaveBeenCalledWith({
      data: [{ user_id: 'u1', badge_code: 'STARTER' }],
      skipDuplicates: true,
    })
  })

  it('grants activity badges on first approved submissions', async () => {
    const submissionCount = vi.fn(async (args: any) => {
      return args.where.activity_code === 'EXPLORE' ? 1 : 1
    })
    const tx = {
      earnedBadge: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      learnTagGrant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      submission: {
        count: submissionCount,
      },
    }

    await grantBadgesForUser(tx as any, 'u2')

    expect(tx.earnedBadge.createMany).toHaveBeenCalledTimes(1)
    expect(tx.earnedBadge.createMany).toHaveBeenCalledWith({
      data: [
        { user_id: 'u2', badge_code: 'IN_CLASS_INNOVATOR' },
        { user_id: 'u2', badge_code: 'COMMUNITY_VOICE' },
      ],
      skipDuplicates: true,
    })
  })

  it('skips already earned badges', async () => {
    const submissionCount = vi.fn(async (args: any) => {
      return args.where.activity_code === 'PRESENT' ? 1 : 1
    })
    const tx = {
      earnedBadge: {
        findMany: vi.fn().mockResolvedValue([
          { badge_code: 'STARTER' },
          { badge_code: 'IN_CLASS_INNOVATOR' },
        ]),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learnTagGrant: {
        findMany: vi.fn().mockResolvedValue([
          { tag_name: 'elevate-ai-1-completed' },
          { tag_name: 'elevate-ai-2-completed' },
        ]),
      },
      submission: {
        count: submissionCount,
      },
    }

    await grantBadgesForUser(tx as any, 'u3')

    expect(tx.earnedBadge.createMany).toHaveBeenCalledTimes(1)
    expect(tx.earnedBadge.createMany).toHaveBeenCalledWith({
      data: [{ user_id: 'u3', badge_code: 'COMMUNITY_VOICE' }],
      skipDuplicates: true,
    })
  })
})
