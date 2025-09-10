import type { Prisma } from '@elevate/db'
import { SubmissionLimitError } from '@elevate/types'

import { grantBadgesForUser } from './scoring'

interface AmplifyPayload {
  peers_trained: number
  students_trained: number
  session_date: string
  session_start_time?: string | null
  location?: { city?: string | null } | null
}

interface Caps {
  peersPer7d: number
  studentsPer7d: number
}

export interface ApproveAmplifyOptions {
  submissionId: string
  userId: string
  payload: AmplifyPayload
  orgTimezone: string
  caps: Caps
  reviewerId?: string
  duplicateWindowMinutes?: number
}

function toUtc(date: string, time: string | undefined, tz: string): Date {
  const dt = new Date(`${date}T${time ?? '00:00'}:00Z`)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(dt)
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const match = tzName.match(/GMT([+-])(\d{1,2})/)
  const hours = match?.[2] ? parseInt(match[2], 10) : 0
  const sign = match?.[1] === '-' ? -1 : 1
  const offset = hours * sign
  return new Date(dt.getTime() - offset * 60 * 60 * 1000)
}

export async function approveAmplifySubmission(
  tx: Prisma.TransactionClient,
  opts: ApproveAmplifyOptions,
): Promise<{ warnings: string[] }> {
  const warnings: string[] = []
  const dupWindow = opts.duplicateWindowMinutes ?? 45

  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('AMPLIFY:' || ${opts.userId}))`

  const sessionStart = toUtc(
    opts.payload.session_date,
    opts.payload.session_start_time ?? null ?? undefined,
    opts.orgTimezone,
  )
  const startOfDay = toUtc(opts.payload.session_date, '00:00', opts.orgTimezone)
  const windowStart = new Date(startOfDay.getTime() - 6 * 86400000)
  const windowEnd = new Date(startOfDay.getTime() + 86400000 - 1)

  const existing = await tx.submission.findMany({
    where: {
      user_id: opts.userId,
      activity_code: 'AMPLIFY',
      status: 'APPROVED',
    },
  })

  let peersUsed = 0
  let studentsUsed = 0
  let duplicateFlag = false

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v)
  const toAmplifyPayload = (raw: unknown): AmplifyPayload => {
    const obj = isRecord(raw) ? raw : {}
    const peers = typeof obj.peers_trained === 'number' ? obj.peers_trained : 0
    const students =
      typeof obj.students_trained === 'number' ? obj.students_trained : 0
    const session_date =
      typeof obj.session_date === 'string' ? obj.session_date : ''
    const session_start_time =
      typeof obj.session_start_time === 'string' ? obj.session_start_time : null
    const loc = isRecord(obj.location) ? obj.location : undefined
    const city = loc && typeof loc.city === 'string' ? { city: loc.city } : null
    return {
      peers_trained: peers,
      students_trained: students,
      session_date,
      session_start_time,
      location: city,
    }
  }

  for (const sub of existing) {
    const data = toAmplifyPayload(sub.payload)
    const otherStart = toUtc(
      data.session_date,
      data.session_start_time ?? null ?? undefined,
      opts.orgTimezone,
    )
    if (otherStart >= windowStart && otherStart <= windowEnd) {
      peersUsed += data.peers_trained || 0
      studentsUsed += data.students_trained || 0
    }
    if (
      opts.payload.session_start_time &&
      data.session_start_time &&
      opts.payload.location?.city &&
      data.location?.city &&
      data.location.city.toLowerCase() ===
        opts.payload.location.city.toLowerCase()
    ) {
      const diff =
        Math.abs(otherStart.getTime() - sessionStart.getTime()) / 60000
      if (diff <= dupWindow) {
        duplicateFlag = true
      }
    }
  }

  if (!opts.payload.session_start_time) {
    warnings.push('MISSING_SESSION_START_TIME')
  } else if (!opts.payload.location?.city) {
    warnings.push('MISSING_CITY')
  } else if (duplicateFlag) {
    warnings.push('DUPLICATE_SESSION_SUSPECT')
  }

  if (peersUsed + opts.payload.peers_trained > opts.caps.peersPer7d) {
    throw new SubmissionLimitError(
      'Peer training',
      peersUsed + opts.payload.peers_trained,
      opts.caps.peersPer7d,
    )
  }
  if (studentsUsed + opts.payload.students_trained > opts.caps.studentsPer7d) {
    throw new SubmissionLimitError(
      'Student training',
      studentsUsed + opts.payload.students_trained,
      opts.caps.studentsPer7d,
    )
  }

  await tx.submission.update({
    where: { id: opts.submissionId },
    data: {
      status: 'APPROVED',
      approval_org_timezone: opts.orgTimezone,
      ...(opts.reviewerId !== undefined
        ? { reviewer_id: opts.reviewerId }
        : {}),
    },
  })

  await tx.pointsLedger.create({
    data: {
      user_id: opts.userId,
      activity_code: 'AMPLIFY',
      source: 'FORM',
      delta_points:
        opts.payload.peers_trained * 2 + opts.payload.students_trained,
      external_event_id: `submission:${opts.submissionId}:approved:v1`,
      event_time: sessionStart,
      meta: {},
    },
  })

  await grantBadgesForUser(tx, opts.userId)

  return { warnings }
}
