/**
 * Integration Test: Complete Submission Approval Flow
 * 
 * Tests the critical business flow:
 * 1. User submits evidence for a LEAPS stage
 * 2. Admin reviews and approves submission
 * 3. Points are correctly awarded to user
 * 4. Leaderboard updates appropriately
 * 5. Audit trail is created
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestDatabase } from '../../packages/db/tests/helpers'
import { TestData, executeApiRoute, createMockRequest, mockAuthentication, clearAuthenticationMock } from '../helpers/test-server'
import { ACTIVITY_CODES, USER_ROLES, SUBMISSION_STATUSES } from '@elevate/types'

// Import the API route handlers we need to test
let adminSubmissionsHandler: (req: Request) => Promise<Response>
let leaderboardHandler: (req: Request) => Promise<Response>

describe('Integration: Submission Approval Flow', () => {
  let testDb: TestDatabase
  let testUser: { id: string; email: string; handle: string }
  let testReviewer: { id: string; email: string; handle: string }
  let testSubmission: { id: string }

  beforeEach(async () => {
    // Setup isolated test database
    testDb = new TestDatabase()
    await testDb.setup()

    // Create test users
    testUser = await testDb.fixtures.createTestUser({
      handle: 'testparticipant',
      name: 'Test Participant',
      email: 'participant@example.com',
      role: USER_ROLES[0] // PARTICIPANT
    })

    testReviewer = await testDb.fixtures.createTestUser({
      handle: 'testreviewer', 
      name: 'Test Reviewer',
      email: 'reviewer@example.com',
      role: USER_ROLES[1] // REVIEWER
    })

    // Create a test submission in PENDING status
    testSubmission = await testDb.fixtures.createTestSubmission({
      user_id: testUser.id,
      activity_code: ACTIVITY_CODES[0], // LEARN
      status: SUBMISSION_STATUSES[0], // PENDING
      visibility: 'PRIVATE', // Would use VISIBILITY_OPTIONS[0] but this is test data
      payload: {
        certificate_url: '/uploads/test-certificate.pdf',
        course_name: 'AI in Education Fundamentals',
        completion_date: new Date().toISOString(),
        hash: 'abc123def456'
      }
    })

    // Mock the prisma client to use our test database
    vi.doMock('@elevate/db', () => ({
      prisma: testDb.prisma
    }))

    vi.doMock('@elevate/db/client', () => ({
      prisma: testDb.prisma
    }))

    // Import handlers after mocking
    const adminModule = await import('../../apps/admin/app/api/admin/submissions/route')
    const leaderboardModule = await import('../../apps/web/app/api/leaderboard/route')
    
    adminSubmissionsHandler = adminModule.PATCH
    leaderboardHandler = leaderboardModule.GET
  })

  afterEach(async () => {
    await testDb.cleanup()
    clearAuthenticationMock()
    vi.clearAllMocks()
  })

  it('should complete the full submission approval flow successfully', async () => {
    // Step 1: Verify initial state - no points awarded yet
    const initialPoints = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id }
    })
    expect(initialPoints).toHaveLength(0)

    // Step 2: Reviewer approves the submission
    const approvalRequest = createMockRequest('/api/admin/submissions', {
      method: 'PATCH',
      body: {
        submissionId: testSubmission.id,
        action: 'approve',
        reviewNote: 'Great certificate! Well done.',
      },
      user: {
        userId: testReviewer.id,
        role: USER_ROLES[1] // REVIEWER
      }
    })

    const approvalResponse = await executeApiRoute(adminSubmissionsHandler, approvalRequest)

    // Verify approval response
    expect(approvalResponse.status).toBe(200)
    const approvalData = await approvalResponse.json()
    expect(approvalData.success).toBe(true)
    expect(approvalData.data.message).toMatch(/approved successfully/)

    // Step 3: Verify submission status was updated
    const updatedSubmission = await testDb.prisma.submission.findUnique({
      where: { id: testSubmission.id }
    })
    expect(updatedSubmission?.status).toBe(SUBMISSION_STATUSES[1]) // APPROVED
    expect(updatedSubmission?.reviewer_id).toBe(testReviewer.id)
    expect(updatedSubmission?.review_note).toBe('Great certificate! Well done.')

    // Step 4: Verify points were awarded correctly
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id },
      include: { activity: true }
    })
    
    expect(pointsEntries).toHaveLength(1)
    const pointsEntry = pointsEntries[0]
    expect(pointsEntry.activity_code).toBe(ACTIVITY_CODES[0]) // LEARN
    expect(pointsEntry.delta_points).toBe(20) // Default points for LEARN
    expect(pointsEntry.source).toBe('MANUAL') // Would use LEDGER_SOURCES[0] but this is database-generated
    expect(pointsEntry.external_source).toBe('admin_approval')
    expect(pointsEntry.external_event_id).toBe(`submission_${testSubmission.id}`)

    // Step 5: Verify audit trail was created
    const auditLogs = await testDb.prisma.auditLog.findMany({
      where: { 
        actor_id: testReviewer.id,
        target_id: testSubmission.id
      },
      orderBy: { created_at: 'asc' }
    })
    
    expect(auditLogs).toHaveLength(1)
    const auditLog = auditLogs[0]
    expect(auditLog.action).toBe('APPROVE_SUBMISSION')
    expect(auditLog.meta).toMatchObject({
      entityType: 'submission',
      entityId: testSubmission.id,
      reviewNote: 'Great certificate! Well done.',
      submissionType: 'LEARN'
    })

    // Step 6: Verify leaderboard reflects the points (if user makes profile public)
    await testDb.prisma.submission.update({
      where: { id: testSubmission.id },
      data: { visibility: 'PUBLIC' }
    })

    const leaderboardRequest = createMockRequest('/api/leaderboard')
    const leaderboardResponse = await executeApiRoute(leaderboardHandler, leaderboardRequest)
    
    expect(leaderboardResponse.status).toBe(200)
    const leaderboardData = await leaderboardResponse.json()
    expect(leaderboardData.success).toBe(true)
    
    // Find our test user in the leaderboard
    const userEntry = leaderboardData.data.leaderboard.find((entry: { user: { id: string } }) => 
      entry.user.id === testUser.id
    )
    expect(userEntry).toBeDefined()
    expect(userEntry.total_points).toBe(20)

    // Step 7: Verify user stats are correct
    const userStats = await testDb.fixtures.getStats()
    expect(userStats.totalPoints).toBe(20)
    expect(userStats.pointsEntries).toBe(1)
  })

  it('should handle point adjustments during approval', async () => {
    // Reviewer approves with point adjustment
    const approvalRequest = createMockRequest('/api/admin/submissions', {
      method: 'PATCH', 
      body: {
        submissionId: testSubmission.id,
        action: 'approve',
        reviewNote: 'Good work, but certificate quality could be better',
        pointAdjustment: 15 // Reduced from default 20
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const response = await executeApiRoute(adminSubmissionsHandler, approvalRequest)
    expect(response.status).toBe(200)

    // Verify adjusted points were awarded
    const pointsEntry = await testDb.prisma.pointsLedger.findFirst({
      where: { user_id: testUser.id }
    })
    expect(pointsEntry?.delta_points).toBe(15)

    // Verify additional audit log for point adjustment
    const adjustmentAudit = await testDb.prisma.auditLog.findFirst({
      where: {
        actor_id: testReviewer.id,
        action: 'ADJUST_POINTS'
      }
    })
    expect(adjustmentAudit).toBeDefined()
    expect(adjustmentAudit?.meta).toMatchObject({
      basePoints: 20,
      adjustedPoints: 15
    })
  })

  it('should reject submissions and not award points', async () => {
    // Reviewer rejects the submission
    const rejectionRequest = createMockRequest('/api/admin/submissions', {
      method: 'PATCH',
      body: {
        submissionId: testSubmission.id,
        action: 'reject',
        reviewNote: 'Certificate appears to be fraudulent'
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const response = await executeApiRoute(adminSubmissionsHandler, rejectionRequest)
    expect(response.status).toBe(200)

    // Verify submission was rejected
    const updatedSubmission = await testDb.prisma.submission.findUnique({
      where: { id: testSubmission.id }
    })
    expect(updatedSubmission?.status).toBe('REJECTED')

    // Verify no points were awarded
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id }
    })
    expect(pointsEntries).toHaveLength(0)

    // Verify audit trail shows rejection
    const auditLog = await testDb.prisma.auditLog.findFirst({
      where: {
        actor_id: testReviewer.id,
        action: 'REJECT_SUBMISSION'
      }
    })
    expect(auditLog).toBeDefined()
  })

  it('should prevent double approval of the same submission', async () => {
    // First approval
    const firstRequest = createMockRequest('/api/admin/submissions', {
      method: 'PATCH',
      body: {
        submissionId: testSubmission.id,
        action: 'approve'
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const firstResponse = await executeApiRoute(adminSubmissionsHandler, firstRequest)
    expect(firstResponse.status).toBe(200)

    // Attempt second approval
    const secondRequest = createMockRequest('/api/admin/submissions', {
      method: 'PATCH',
      body: {
        submissionId: testSubmission.id,
        action: 'approve'
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const secondResponse = await executeApiRoute(adminSubmissionsHandler, secondRequest)
    expect(secondResponse.status).toBe(400) // Should be a client error
    
    const errorData = await secondResponse.json()
    expect(errorData.success).toBe(false)
    expect(errorData.error).toMatch(/already been reviewed/i)

    // Verify only one points entry exists
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id }
    })
    expect(pointsEntries).toHaveLength(1)
  })

  it('should enforce point adjustment bounds', async () => {
    // Try to adjust points way beyond allowed bounds (±20%)
    const request = createMockRequest('/api/admin/submissions', {
      method: 'PATCH',
      body: {
        submissionId: testSubmission.id,
        action: 'approve',
        pointAdjustment: 50 // Way more than allowed for 20 base points
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const response = await executeApiRoute(adminSubmissionsHandler, request)
    expect(response.status).toBe(400)
    
    const errorData = await response.json()
    expect(errorData.error).toMatch(/point adjustment must be within/i)

    // Verify no points were awarded
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id }
    })
    expect(pointsEntries).toHaveLength(0)
  })

  it('should handle bulk approval correctly', async () => {
    // Create additional submissions
    const submission2 = await testDb.fixtures.createTestSubmission({
      user_id: testUser.id,
      activity_code: 'EXPLORE',
      status: 'PENDING'
    })

    const submission3 = await testDb.fixtures.createTestSubmission({
      user_id: testUser.id,
      activity_code: 'PRESENT',
      status: 'PENDING'
    })

    // Import bulk handler
    const adminModule = await import('../../apps/admin/app/api/admin/submissions/route')
    const bulkHandler = adminModule.POST

    // Bulk approve
    const bulkRequest = createMockRequest('/api/admin/submissions', {
      method: 'POST',
      body: {
        submissionIds: [testSubmission.id, submission2.id, submission3.id],
        action: 'approve',
        reviewNote: 'Bulk approved after review'
      },
      user: {
        userId: testReviewer.id,
        role: 'REVIEWER'
      }
    })

    const response = await executeApiRoute(bulkHandler, bulkRequest)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.data.processed).toBe(3)

    // Verify all submissions were approved
    const updatedSubmissions = await testDb.prisma.submission.findMany({
      where: {
        id: { in: [testSubmission.id, submission2.id, submission3.id] }
      }
    })
    
    expect(updatedSubmissions.every(s => s.status === 'APPROVED')).toBe(true)

    // Verify correct points were awarded (20 + 50 + 20 = 90)
    const totalPoints = await testDb.prisma.pointsLedger.aggregate({
      where: { user_id: testUser.id },
      _sum: { delta_points: true }
    })
    expect(totalPoints._sum.delta_points).toBe(90)
  })
})
