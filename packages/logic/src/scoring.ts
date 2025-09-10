import type { Prisma } from '@elevate/db'
import type { ActivityCode, AmplifyInput } from '@elevate/types'
import { activityCanon, badgeCanon, computeAmplifyPoints } from '@elevate/types/activity-canon'

export function computePoints(activity: ActivityCode, payload: unknown): number {
  switch (activity) {
    case 'LEARN':
      // LEARN points are sourced from tags via webhook; cap is 20 total
      return activityCanon.learn.cap
    case 'EXPLORE':
      return activityCanon.explore.onApproved
    case 'AMPLIFY': {
      const amplifyPayload = payload as AmplifyInput
      const peers = Number((amplifyPayload as { peers_trained?: unknown })?.peers_trained ?? 0)
      const students = Number((amplifyPayload as { students_trained?: unknown })?.students_trained ?? 0)
      const capPeers = Math.min(peers, activityCanon.amplify.limits.weeklyPeers)
      const capStudents = Math.min(students, activityCanon.amplify.limits.weeklyStudents)
      return computeAmplifyPoints(capPeers, capStudents)
    }
    case 'PRESENT':
      return activityCanon.present.onApproved
    case 'SHINE':
      return 0
    default:
      return 0
  }
}

// Grant sticky badges based on current user state
export async function grantBadgesForUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const existing = await tx.earnedBadge.findMany({
    where: { user_id: userId },
    select: { badge_code: true },
  })
  const have = new Set(existing.map((b) => b.badge_code))

  const toInsert: string[] = []

  if (!have.has('STARTER')) {
    const tags = await tx.learnTagGrant.findMany({
      where: {
        user_id: userId,
        tag_name: { in: [...badgeCanon.STARTER.requiresTags] },
      },
      select: { tag_name: true },
    })
    const tagSet = new Set(tags.map((t) => t.tag_name.toLowerCase()))
    const [t1, t2] = badgeCanon.STARTER.requiresTags
    if (tagSet.has(t1) && tagSet.has(t2)) {
      toInsert.push('STARTER')
    }
  }

  if (!have.has('IN_CLASS_INNOVATOR')) {
    const exploreCount = await tx.submission.count({
      where: { user_id: userId, activity_code: badgeCanon.IN_CLASS_INNOVATOR.requiresApprovedActivity, status: 'APPROVED' },
    })
    if (exploreCount > 0) toInsert.push('IN_CLASS_INNOVATOR')
  }

  if (!have.has('COMMUNITY_VOICE')) {
    const presentCount = await tx.submission.count({
      where: { user_id: userId, activity_code: badgeCanon.COMMUNITY_VOICE.requiresApprovedActivity, status: 'APPROVED' },
    })
    if (presentCount > 0) toInsert.push('COMMUNITY_VOICE')
  }

  if (toInsert.length > 0) {
    await tx.earnedBadge.createMany({
      data: toInsert.map((code) => ({ user_id: userId, badge_code: code })),
      skipDuplicates: true,
    })
  }
}
