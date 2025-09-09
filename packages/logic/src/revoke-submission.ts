import type { Prisma } from '@elevate/db'

import { grantBadgesForUser } from './scoring'

interface RevokeOptions {
  submissionId: string
  actorId: string
  reason?: string
}

/**
 * Revokes an approved submission by writing a compensating ledger entry
 * and updating the submission status to REVOKED.
 */
export async function revokeSubmission(
  tx: Prisma.TransactionClient,
  opts: RevokeOptions,
): Promise<void> {
  const submission = await tx.submission.findUniqueOrThrow({
    where: { id: opts.submissionId },
  })

  if (submission.status !== 'APPROVED') {
    throw new Error('Submission not in APPROVED state')
  }

  const approvedId = `submission:${opts.submissionId}:approved:v1`
  const revokeId = `submission:${opts.submissionId}:revoked:v1`

  const existingRevoke = await tx.pointsLedger.findUnique({
    where: { external_event_id: revokeId },
  })
  if (existingRevoke) return

  const entry = await tx.pointsLedger.findUnique({
    where: { external_event_id: approvedId },
  })
  if (!entry) {
    throw new Error('Original ledger entry not found')
  }

  await tx.submission.update({
    where: { id: opts.submissionId },
    data: { status: 'REVOKED', reviewer_id: opts.actorId },
  })

  await tx.pointsLedger.create({
    data: {
      user_id: submission.user_id,
      activity_code: submission.activity_code,
      source: 'FORM',
      delta_points: -entry.delta_points,
      external_event_id: revokeId,
      event_time: entry.event_time,
      meta: {},
    },
  })

  await tx.auditLog.create({
    data: {
      actor_id: opts.actorId,
      action: 'submission.revoked',
      target_id: opts.submissionId,
      meta: opts.reason ? { reason: opts.reason } : undefined,
    },
  })

  await grantBadgesForUser(tx, submission.user_id)
}
