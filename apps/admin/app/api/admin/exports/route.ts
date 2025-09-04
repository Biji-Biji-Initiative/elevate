import { type NextRequest, NextResponse } from 'next/server'

import { requireRole, createErrorResponse } from '@elevate/auth/server-helpers'
import { Prisma, prisma } from '@elevate/db'
import { withRateLimit, adminRateLimiter } from '@elevate/security'
import { parseActivityCode, parseSubmissionStatus, toPrismaJson, buildAuditMeta, ExportsQuerySchema, type UserWhereClause, type SubmissionWhereClause, type PointsLedgerWhereClause, type ActivityCode } from '@elevate/types'

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return withRateLimit(request, adminRateLimiter, async () => {
  try {
    const user = await requireRole('admin')
    const { searchParams } = new URL(request.url)
    const parsed = ExportsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return createErrorResponse(new Error('Invalid export query'), 400)
    }
    const { type, format, startDate, endDate, activity, status, cohort } = parsed.data
    
    if (format !== 'csv') {
      return createErrorResponse(new Error('Only CSV format is supported'), 400)
    }
    
    let csvContent = ''
    let filename = ''
    
    switch (type) {
      case 'submissions':
        const result = await generateSubmissionsCSV({
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          activity: activity ?? null,
          status: status ?? null,
          cohort: cohort ?? null
        })
        csvContent = result.csv
        filename = result.filename
        break
        
      case 'users':
        const userResult = await generateUsersCSV({ cohort: cohort ?? null })
        csvContent = userResult.csv
        filename = userResult.filename
        break
        
      case 'leaderboard':
        const leaderboardResult = await generateLeaderboardCSV({ cohort: cohort ?? null })
        csvContent = leaderboardResult.csv
        filename = leaderboardResult.filename
        break
        
      case 'points':
        const pointsResult = await generatePointsLedgerCSV({
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          cohort: cohort ?? null
        })
        csvContent = pointsResult.csv
        filename = pointsResult.filename
        break
        
      default:
        return createErrorResponse(new Error('Invalid export type'), 400)
    }
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        actor_id: user.userId,
        action: 'EXPORT_DATA',
        meta: buildAuditMeta({ entityType: 'export', entityId: type }, {
          type,
          format,
          filters: { startDate, endDate, activity, status, cohort }
        }) as Prisma.InputJsonValue
      }
    })
    
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
    
    return response
    
  } catch (error) {
    return createErrorResponse(error, 500)
  }
  })
}

async function generateSubmissionsCSV(filters: {
  startDate?: string | null
  endDate?: string | null
  activity?: string | null
  status?: string | null
  cohort?: string | null
}) {
  const where: SubmissionWhereClause = {}
  
  if (filters.startDate && filters.endDate) {
    where.created_at = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    }
  }
  
  if (filters.activity && filters.activity !== 'ALL') {
    const parsedActivity = parseActivityCode(filters.activity)
    if (parsedActivity) {
      where.activity_code = parsedActivity
    }
  }
  
  if (filters.status && filters.status !== 'ALL') {
    const parsedStatus = parseSubmissionStatus(filters.status)
    if (parsedStatus) {
      where.status = parsedStatus
    }
  }
  
  if (filters.cohort && filters.cohort !== 'ALL') {
    where.user = {
      cohort: filters.cohort
    }
  }
  
  const submissions = await prisma.submission.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          email: true,
          school: true,
          cohort: true
        }
      },
      activity: true
    },
    orderBy: {
      created_at: 'desc'
    }
  })
  
  const headers = [
    'Submission ID',
    'User Handle',
    'User Name',
    'User Email',
    'School',
    'Cohort',
    'Activity',
    'Status',
    'Visibility',
    'Reviewer ID',
    'Review Note',
    'Created At',
    'Updated At',
    'Payload'
  ]
  
  const rows = submissions.map(sub => [
    sub.id,
    sub.user.handle,
    sub.user.name,
    sub.user.email,
    sub.user.school || '',
    sub.user.cohort || '',
    sub.activity.name,
    sub.status,
    sub.visibility,
    sub.reviewer_id || '',
    sub.review_note || '',
    sub.created_at.toISOString(),
    sub.updated_at.toISOString(),
    JSON.stringify(sub.payload)
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `submissions-export-${timestamp}.csv`
  
  return { csv, filename }
}

async function generateUsersCSV(filters: { cohort?: string | null }) {
  const where: UserWhereClause = {}
  
  if (filters.cohort && filters.cohort !== 'ALL') {
    where.cohort = filters.cohort
  }
  
  const users = await prisma.user.findMany({
    where,
    include: {
      _count: {
        select: {
          submissions: true,
          earned_badges: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  })
  
  // Get point totals
  const userIds = users.map(u => u.id)
  const pointTotals = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    where: {
      user_id: { in: userIds }
    },
    _sum: {
      delta_points: true
    }
  })
  
  const pointsMap = pointTotals.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.user_id] = pt._sum.delta_points || 0
    return acc
  }, {})
  
  const headers = [
    'User ID',
    'Handle',
    'Name',
    'Email',
    'Role',
    'School',
    'Cohort',
    'Total Points',
    'Submissions Count',
    'Badges Count',
    'Created At'
  ]
  
  const rows = users.map(user => [
    user.id,
    user.handle,
    user.name,
    user.email,
    user.role,
    user.school || '',
    user.cohort || '',
    pointsMap[user.id] || 0,
    user._count.submissions,
    user._count.earned_badges,
    user.created_at.toISOString()
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `users-export-${timestamp}.csv`
  
  return { csv, filename }
}

async function generateLeaderboardCSV(filters: { cohort?: string | null }) {
  const where: UserWhereClause = {}
  
  if (filters.cohort && filters.cohort !== 'ALL') {
    where.cohort = filters.cohort
  }
  
  // Get users with point totals
  const pointTotals = await prisma.pointsLedger.groupBy({
    by: ['user_id'],
    _sum: {
      delta_points: true
    },
    orderBy: {
      _sum: {
        delta_points: 'desc'
      }
    }
  })
  
  const userIds = pointTotals.map(pt => pt.user_id)
  
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      ...where
    },
    select: {
      id: true,
      handle: true,
      name: true,
      email: true,
      school: true,
      cohort: true,
      created_at: true
    }
  })
  
  const usersMap = users.reduce((acc, user) => {
    acc[user.id] = user
    return acc
  }, {} as Record<string, typeof users[0]>)
  
  const headers = [
    'Rank',
    'User Handle',
    'User Name',
    'Email',
    'School',
    'Cohort',
    'Total Points',
    'Joined At'
  ]
  
  const rows = pointTotals
    .filter(pt => usersMap[pt.user_id]) // Only include users that match filters
    .map((pt, index) => {
      const user = usersMap[pt.user_id]
      if (!user) {
        // This should never happen due to filter above, but TypeScript needs the check
        return []
      }
      return [
        index + 1,
        user.handle,
        user.name,
        user.email,
        user.school || '',
        user.cohort || '',
        pt._sum.delta_points || 0,
        user.created_at.toISOString()
      ]
    })
    .filter(row => row.length > 0) // Remove any empty rows
  
  const csv = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `leaderboard-export-${timestamp}.csv`
  
  return { csv, filename }
}

async function generatePointsLedgerCSV(filters: {
  startDate?: string | null
  endDate?: string | null
  cohort?: string | null
}) {
  const where: PointsLedgerWhereClause = {}
  
  if (filters.startDate && filters.endDate) {
    where.created_at = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate)
    }
  }
  
  if (filters.cohort && filters.cohort !== 'ALL') {
    where.user = {
      cohort: filters.cohort
    }
  }
  
  const ledgerEntries = await prisma.pointsLedger.findMany({
    where,
    include: {
      user: {
        select: {
          handle: true,
          name: true,
          email: true,
          school: true,
          cohort: true
        }
      },
      activity: true
    },
    orderBy: {
      created_at: 'desc'
    }
  })
  
  const headers = [
    'Entry ID',
    'User Handle',
    'User Name',
    'User Email',
    'School',
    'Cohort',
    'Activity',
    'Points',
    'Source',
    'External Source',
    'External Event ID',
    'Created At'
  ]
  
  const rows = ledgerEntries.map(entry => [
    entry.id,
    entry.user.handle,
    entry.user.name,
    entry.user.email,
    entry.user.school || '',
    entry.user.cohort || '',
    entry.activity.name,
    entry.delta_points,
    entry.source,
    entry.external_source || '',
    entry.external_event_id || '',
    entry.created_at.toISOString()
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `points-ledger-export-${timestamp}.csv`
  
  return { csv, filename }
}
