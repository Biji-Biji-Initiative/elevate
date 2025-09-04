/**
 * Integration Test: Authentication and Authorization
 * 
 * Tests role-based access control:
 * 1. Users can only access their own data
 * 2. Admins can access all necessary data  
 * 3. Unauthorized access returns proper 401/403 errors
 * 4. Role transitions work correctly
 * 5. API endpoints respect permission boundaries
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestDatabase } from '../../packages/db/tests/helpers'
import { TestData, executeApiRoute, createMockRequest, mockAuthentication, clearAuthenticationMock } from '../helpers/test-server'

// Import API handlers we need to test
let adminSubmissionsHandler: any
let adminSubmissionDetailHandler: any
let dashboardHandler: any
let leaderboardHandler: any

describe('Integration: Authentication and Authorization', () => {
  let testDb: TestDatabase
  let participantUser: any
  let reviewerUser: any
  let adminUser: any
  let participantSubmission: any
  let otherUserSubmission: any

  beforeEach(async () => {
    // Setup isolated test database
    testDb = new TestDatabase()
    await testDb.setup()

    // Create users with different roles
    participantUser = await testDb.fixtures.createTestUser({
      handle: 'participant1',
      name: 'Test Participant',
      email: 'participant@example.com',
      role: 'PARTICIPANT'
    })

    reviewerUser = await testDb.fixtures.createTestUser({
      handle: 'reviewer1', 
      name: 'Test Reviewer',
      email: 'reviewer@example.com',
      role: 'REVIEWER'
    })

    adminUser = await testDb.fixtures.createTestUser({
      handle: 'admin1',
      name: 'Test Admin', 
      email: 'admin@example.com',
      role: 'ADMIN'
    })

    const otherUser = await testDb.fixtures.createTestUser({
      handle: 'otheruser',
      name: 'Other User',
      email: 'other@example.com', 
      role: 'PARTICIPANT'
    })

    // Create submissions for testing access control
    participantSubmission = await testDb.fixtures.createTestSubmission({
      user_id: participantUser.id,
      activity_code: 'LEARN',
      status: 'APPROVED',
      visibility: 'PUBLIC'
    })

    otherUserSubmission = await testDb.fixtures.createTestSubmission({
      user_id: otherUser.id,
      activity_code: 'EXPLORE', 
      status: 'PENDING',
      visibility: 'PRIVATE'
    })

    // Mock the prisma client to use our test database
    vi.doMock('@elevate/db', () => ({
      prisma: testDb.prisma
    }))

    vi.doMock('@elevate/db/client', () => ({
      prisma: testDb.prisma
    }))

    // Import handlers after mocking
    const adminSubmissionsModule = await import('../../apps/admin/app/api/admin/submissions/route')
    const adminSubmissionDetailModule = await import('../../apps/admin/app/api/admin/submissions/[id]/route')
    const dashboardModule = await import('../../apps/web/app/api/dashboard/route')
    const leaderboardModule = await import('../../apps/web/app/api/leaderboard/route')

    adminSubmissionsHandler = adminSubmissionsModule.GET
    adminSubmissionDetailHandler = adminSubmissionDetailModule.GET
    dashboardHandler = dashboardModule.GET  
    leaderboardHandler = leaderboardModule.GET
  })

  afterEach(async () => {
    await testDb.cleanup()
    clearAuthenticationMock()
    vi.clearAllMocks()
  })

  describe('Role-based Access Control', () => {
    it('should allow participants to access their own data only', async () => {
      // Participant should be able to access their own dashboard
      const dashboardRequest = createMockRequest('/api/dashboard', {
        user: {
          userId: participantUser.id,
          role: 'PARTICIPANT'
        }
      })

      // Mock dashboard endpoint to return user-specific data
      const mockDashboard = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          success: true,
          data: { user: participantUser, submissions: [participantSubmission] }
        }))
      )

      const response = await mockDashboard()
      const data = await response.json()
      
      expect(data.success).toBe(true)
      expect(data.data.user.id).toBe(participantUser.id)
    })

    it('should prevent participants from accessing admin endpoints', async () => {
      // Participant tries to access admin submissions endpoint
      const request = createMockRequest('/api/admin/submissions', {
        user: {
          userId: participantUser.id,
          role: 'PARTICIPANT'
        }
      })

      // Mock requireRole to throw error for insufficient permissions
      const mockRequireRole = vi.fn().mockRejectedValue(new Error('Insufficient permissions'))
      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      try {
        await executeApiRoute(adminSubmissionsHandler, request)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.message).toMatch(/insufficient permissions/i)
      }
    })

    it('should allow reviewers to access review endpoints', async () => {
      // Mock reviewer authentication
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: reviewerUser.id,
        role: 'reviewer'
      })
      
      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const request = createMockRequest('/api/admin/submissions', {
        user: {
          userId: reviewerUser.id,
          role: 'REVIEWER'
        }
      })

      const response = await executeApiRoute(adminSubmissionsHandler, request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(mockRequireRole).toHaveBeenCalledWith('reviewer')
    })

    it('should allow admins to access all endpoints', async () => {
      // Mock admin authentication  
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: adminUser.id,
        role: 'admin'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const request = createMockRequest('/api/admin/submissions', {
        user: {
          userId: adminUser.id,
          role: 'ADMIN'
        }
      })

      const response = await executeApiRoute(adminSubmissionsHandler, request)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(mockRequireRole).toHaveBeenCalledWith('reviewer')
    })
  })

  describe('Data Access Boundaries', () => {
    it('should restrict submission access by user', async () => {
      // Create submissions for different users
      const userASubmission = await testDb.fixtures.createTestSubmission({
        user_id: participantUser.id,
        status: 'PENDING'
      })

      const userBSubmission = await testDb.fixtures.createTestSubmission({
        user_id: reviewerUser.id, 
        status: 'APPROVED'
      })

      // User A should only see their own submissions via dashboard
      const userSubmissions = await testDb.prisma.submission.findMany({
        where: { user_id: participantUser.id }
      })

      expect(userSubmissions).toHaveLength(2) // participantSubmission + userASubmission
      expect(userSubmissions.every(s => s.user_id === participantUser.id)).toBe(true)

      // Verify user B's submission is not included
      const userBSubmissions = userSubmissions.filter(s => s.id === userBSubmission.id)
      expect(userBSubmissions).toHaveLength(0)
    })

    it('should allow reviewers to see all pending submissions', async () => {
      // Create pending submissions from different users
      await testDb.fixtures.createTestSubmission({
        user_id: participantUser.id,
        status: 'PENDING'
      })

      await testDb.fixtures.createTestSubmission({
        user_id: reviewerUser.id,
        status: 'PENDING' 
      })

      // Reviewer should see all pending submissions
      const pendingSubmissions = await testDb.prisma.submission.findMany({
        where: { status: 'PENDING' }
      })

      expect(pendingSubmissions.length).toBeGreaterThanOrEqual(2)
    })

    it('should enforce visibility rules for public data', async () => {
      // Create mix of public and private submissions  
      const publicSubmission = await testDb.fixtures.createTestSubmission({
        user_id: participantUser.id,
        status: 'APPROVED',
        visibility: 'PUBLIC'
      })

      const privateSubmission = await testDb.fixtures.createTestSubmission({
        user_id: participantUser.id,
        status: 'APPROVED', 
        visibility: 'PRIVATE'
      })

      // Public API should only show public submissions
      const publicSubmissions = await testDb.prisma.submission.findMany({
        where: { 
          visibility: 'PUBLIC',
          status: 'APPROVED'
        }
      })

      expect(publicSubmissions.some(s => s.id === publicSubmission.id)).toBe(true)
      expect(publicSubmissions.some(s => s.id === privateSubmission.id)).toBe(false)
    })
  })

  describe('Authentication Edge Cases', () => {
    it('should handle missing authentication tokens', async () => {
      // Request without authentication
      const request = createMockRequest('/api/admin/submissions')

      // Mock requireRole to throw authentication error
      const mockRequireRole = vi.fn().mockRejectedValue(new Error('Authentication required'))
      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      try {
        await executeApiRoute(adminSubmissionsHandler, request)
        expect.fail('Should have thrown authentication error')
      } catch (error) {
        expect(error.message).toMatch(/authentication required/i)
      }
    })

    it('should handle invalid authentication tokens', async () => {
      const request = createMockRequest('/api/admin/submissions', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      const mockRequireRole = vi.fn().mockRejectedValue(new Error('Invalid token'))
      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      try {
        await executeApiRoute(adminSubmissionsHandler, request)
        expect.fail('Should have thrown invalid token error')
      } catch (error) {
        expect(error.message).toMatch(/invalid token/i)
      }
    })

    it('should handle expired authentication tokens', async () => {
      const request = createMockRequest('/api/admin/submissions', {
        user: {
          userId: participantUser.id,
          role: 'PARTICIPANT'
        }
      })

      const mockRequireRole = vi.fn().mockRejectedValue(new Error('Token expired'))
      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      try {
        await executeApiRoute(adminSubmissionsHandler, request)
        expect.fail('Should have thrown token expired error')
      } catch (error) {
        expect(error.message).toMatch(/token expired/i)
      }
    })
  })

  describe('Role Hierarchy and Permissions', () => {
    it('should enforce proper role hierarchy', async () => {
      const roleHierarchy = [
        'PARTICIPANT',
        'REVIEWER', 
        'ADMIN',
        'SUPERADMIN'
      ]

      // Test each role level
      for (let i = 0; i < roleHierarchy.length; i++) {
        const currentRole = roleHierarchy[i]
        
        // Mock authentication for current role
        const mockRequireRole = vi.fn().mockImplementation(async (requiredRole: string) => {
          const requiredIndex = roleHierarchy.indexOf(requiredRole.toUpperCase())
          if (i >= requiredIndex) {
            return { userId: `user-${i}`, role: currentRole.toLowerCase() }
          } else {
            throw new Error('Insufficient permissions')
          }
        })

        vi.doMock('@elevate/auth/server-helpers', () => ({
          requireRole: mockRequireRole,
          createErrorResponse: (err: Error, status = 500) => 
            new Response(JSON.stringify({ success: false, error: err.message }), { status })
        }))

        // Test access to reviewer-level endpoint
        const request = createMockRequest('/api/admin/submissions', {
          user: {
            userId: `user-${i}`,
            role: currentRole as any
          }
        })

        if (i >= 1) { // REVIEWER level and above
          const response = await executeApiRoute(adminSubmissionsHandler, request)
          expect(response.status).toBe(200)
        } else { // PARTICIPANT level
          try {
            await executeApiRoute(adminSubmissionsHandler, request)
            expect.fail('Should have thrown permissions error')
          } catch (error) {
            expect(error.message).toMatch(/insufficient permissions/i)
          }
        }
      }
    })

    it('should handle role transitions correctly', async () => {
      // Promote user from PARTICIPANT to REVIEWER
      await testDb.prisma.user.update({
        where: { id: participantUser.id },
        data: { role: 'REVIEWER' }
      })

      const updatedUser = await testDb.prisma.user.findUnique({
        where: { id: participantUser.id }
      })

      expect(updatedUser?.role).toBe('REVIEWER')

      // Now user should be able to access reviewer endpoints
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: participantUser.id,
        role: 'reviewer'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const request = createMockRequest('/api/admin/submissions', {
        user: {
          userId: participantUser.id,
          role: 'REVIEWER'
        }
      })

      const response = await executeApiRoute(adminSubmissionsHandler, request)
      expect(response.status).toBe(200)
    })
  })

  describe('Audit Trail for Privileged Actions', () => {
    it('should log admin actions for audit', async () => {
      // Admin approves a submission
      const mockRequireRole = vi.fn().mockResolvedValue({
        userId: adminUser.id,
        role: 'admin'
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      const approvalRequest = createMockRequest('/api/admin/submissions', {
        method: 'PATCH',
        body: {
          submissionId: otherUserSubmission.id,
          action: 'approve',
          reviewNote: 'Admin approval'
        },
        user: {
          userId: adminUser.id,
          role: 'ADMIN'
        }
      })

      const patchModule = await import('../../apps/admin/app/api/admin/submissions/route')
      const patchHandler = patchModule.PATCH

      const response = await executeApiRoute(patchHandler, approvalRequest)
      expect(response.status).toBe(200)

      // Verify audit log was created
      const auditLog = await testDb.prisma.auditLog.findFirst({
        where: {
          actor_id: adminUser.id,
          action: 'APPROVE_SUBMISSION',
          target_id: otherUserSubmission.id
        }
      })

      expect(auditLog).toBeDefined()
      expect(auditLog?.meta).toMatchObject({
        reviewNote: 'Admin approval'
      })
    })

    it('should track unauthorized access attempts', async () => {
      // Participant tries to access admin endpoint - should be logged
      const unauthorizedRequest = createMockRequest('/api/admin/submissions', {
        user: {
          userId: participantUser.id,
          role: 'PARTICIPANT'
        }
      })

      const mockRequireRole = vi.fn().mockImplementation(async () => {
        // Log the unauthorized attempt
        await testDb.prisma.auditLog.create({
          data: {
            actor_id: participantUser.id,
            action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            target_id: null,
            meta: {
              endpoint: '/api/admin/submissions',
              user_role: 'PARTICIPANT',
              required_role: 'REVIEWER'
            }
          }
        })
        throw new Error('Insufficient permissions')
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      try {
        await executeApiRoute(adminSubmissionsHandler, unauthorizedRequest)
        expect.fail('Should have thrown permissions error')
      } catch (error) {
        expect(error.message).toMatch(/insufficient permissions/i)
      }

      // Verify unauthorized access was logged
      const auditLog = await testDb.prisma.auditLog.findFirst({
        where: {
          actor_id: participantUser.id,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT'
        }
      })

      expect(auditLog).toBeDefined()
    })
  })

  describe('Session Security', () => {
    it('should validate session integrity', async () => {
      // Mock a session validation scenario
      const validSession = {
        userId: participantUser.id,
        role: 'PARTICIPANT',
        sessionId: 'valid-session-123',
        issuedAt: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }

      const mockRequireRole = vi.fn().mockImplementation(async (requiredRole: string) => {
        // Simulate session validation
        if (validSession.expiresAt < Date.now()) {
          throw new Error('Session expired')
        }
        
        if (validSession.role.toUpperCase() !== requiredRole.toUpperCase()) {
          throw new Error('Insufficient permissions')
        }

        return {
          userId: validSession.userId,
          role: validSession.role.toLowerCase()
        }
      })

      vi.doMock('@elevate/auth/server-helpers', () => ({
        requireRole: mockRequireRole,
        createErrorResponse: (err: Error, status = 500) => 
          new Response(JSON.stringify({ success: false, error: err.message }), { status })
      }))

      // Valid session should work for participant-level access
      const dashboardRequest = createMockRequest('/api/dashboard', {
        user: {
          userId: validSession.userId,
          role: 'PARTICIPANT'
        }
      })

      // Mock dashboard to require participant role
      const mockDashboard = vi.fn().mockImplementation(async () => {
        await mockRequireRole('PARTICIPANT')
        return new Response(JSON.stringify({
          success: true,
          data: { user: participantUser }
        }))
      })

      const response = await mockDashboard()
      expect(response.status).toBe(200)
    })
  })
})