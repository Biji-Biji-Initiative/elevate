import type { Prisma } from '@elevate/db'
import type { ActivityCode, AmplifyInput } from '@elevate/types'

export function computePoints(activity: ActivityCode, payload: unknown): number {
  switch (activity) {
    case 'LEARN':
      return 20
    case 'EXPLORE':
      return 50
    case 'AMPLIFY': {
      const amplifyPayload = payload as AmplifyInput
      const peers = Number((amplifyPayload as { peers_trained?: unknown })?.peers_trained ?? 0)
      const students = Number((amplifyPayload as { students_trained?: unknown })?.students_trained ?? 0)
      // Caps (proposal) — enforce upstream in validation too
      const capPeers = Math.min(peers, 50)
      const capStudents = Math.min(students, 200)
      return capPeers * 2 + capStudents * 1
    }
    case 'PRESENT':
      return 20
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
        tag_name: { in: ['elevate-ai-1-completed', 'elevate-ai-2-completed'] },
      },
      select: { tag_name: true },
    })
    const tagSet = new Set(tags.map((t) => t.tag_name.toLowerCase()))
    if (tagSet.has('elevate-ai-1-completed') && tagSet.has('elevate-ai-2-completed')) {
      toInsert.push('STARTER')
    }
  }

  if (!have.has('IN_CLASS_INNOVATOR')) {
    const exploreCount = await tx.submission.count({
      where: { user_id: userId, activity_code: 'EXPLORE', status: 'APPROVED' },
    })
    if (exploreCount > 0) toInsert.push('IN_CLASS_INNOVATOR')
  }

  if (!have.has('COMMUNITY_VOICE')) {
    const presentCount = await tx.submission.count({
      where: { user_id: userId, activity_code: 'PRESENT', status: 'APPROVED' },
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
