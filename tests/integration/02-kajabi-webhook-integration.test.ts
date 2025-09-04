/**
 * Integration Test: Kajabi Webhook Integration
 * 
 * Tests the webhook integration flow:
 * 1. Webhook receives Learn completion event  
 * 2. User is matched by email (case-insensitive)
 * 3. Points are awarded idempotently (no duplicates)
 * 4. Audit trail is created
 * 5. Duplicate webhooks are handled gracefully
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'crypto'
import { TestDatabase } from '../../packages/db/tests/helpers'
import { TestData, executeApiRoute, createWebhookRequest, waitForOperation } from '../helpers/test-server'

let webhookHandler: (req: Request) => Promise<Response>

describe('Integration: Kajabi Webhook Integration', () => {
  let testDb: TestDatabase
  let testUser: { id: string; email: string; handle: string }

  beforeEach(async () => {
    // Setup isolated test database
    testDb = new TestDatabase()
    await testDb.setup()

    // Create test user with email that matches webhook
    testUser = await testDb.fixtures.createTestUser({
      handle: 'learner123',
      name: 'Test Learner',
      email: 'learner@example.com', // This will match the webhook payload
      role: 'PARTICIPANT'
    })

    // Mock the prisma client to use our test database
    vi.doMock('@elevate/db/client', () => ({
      prisma: testDb.prisma
    }))

    // Import handler after mocking
    const webhookModule = await import('../../apps/web/app/api/kajabi/webhook/route')
    webhookHandler = webhookModule.POST
  })

  afterEach(async () => {
    await testDb.cleanup()
    vi.clearAllMocks()
  })

  it('should process learn completion webhook successfully', async () => {
    // Create webhook payload
    const webhookPayload = TestData.kajabiEvent({
      event_type: 'contact.tagged',
      event_id: 'kajabi_12345_67890',
      contact: {
        id: 12345,
        email: 'learner@example.com', // Matches our test user
        first_name: 'Test',
        last_name: 'Learner'
      },
      tag: {
        name: 'LEARN_COMPLETED'
      }
    })

    // Create properly signed webhook request
    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)

    // Process webhook
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.event_id).toBe('kajabi_12345_67890')
    expect(data.data.result.success).toBe(true)
    expect(data.data.result.user_id).toBe(testUser.id)
    expect(data.data.result.points_awarded).toBe(20)

    // Verify user's Kajabi contact ID was updated
    const updatedUser = await testDb.prisma.user.findUnique({
      where: { id: testUser.id }
    })
    expect(updatedUser?.kajabi_contact_id).toBe('12345')

    // Verify points were awarded
    const pointsEntry = await testDb.prisma.pointsLedger.findFirst({
      where: {
        user_id: testUser.id,
        external_event_id: 'kajabi_12345_67890'
      }
    })
    
    expect(pointsEntry).toBeDefined()
    expect(pointsEntry?.activity_code).toBe('LEARN')
    expect(pointsEntry?.delta_points).toBe(20)
    expect(pointsEntry?.source).toBe('WEBHOOK')
    expect(pointsEntry?.external_source).toBe('kajabi')

    // Verify submission was created for audit trail
    const submission = await testDb.prisma.submission.findFirst({
      where: {
        user_id: testUser.id,
        activity_code: 'LEARN'
      }
    })

    expect(submission).toBeDefined()
    expect(submission?.status).toBe('APPROVED')
    expect(submission?.payload).toMatchObject({
      tag_name: 'LEARN_COMPLETED',
      kajabi_contact_id: 12345,
      provider: 'Kajabi',
      auto_approved: true,
      source: 'tag_webhook'
    })

    // Verify Kajabi event was stored
    const kajabiEvent = await testDb.prisma.kajabiEvent.findUnique({
      where: { id: 'kajabi_12345_67890' }
    })

    expect(kajabiEvent).toBeDefined()
    expect(kajabiEvent?.user_match).toBe(testUser.id)
    expect(kajabiEvent?.processed_at).toBeDefined()

    // Verify audit log was created
    const auditLog = await testDb.prisma.auditLog.findFirst({
      where: {
        action: 'KAJABI_COMPLETION_PROCESSED',
        target_id: testUser.id
      }
    })

    expect(auditLog).toBeDefined()
    expect(auditLog?.actor_id).toBe('system')
  })

  it('should handle case-insensitive email matching', async () => {
    // Update user email to mixed case
    await testDb.prisma.user.update({
      where: { id: testUser.id },
      data: { email: 'LEARNER@EXAMPLE.COM' }
    })

    const webhookPayload = TestData.kajabiEvent({
      contact: {
        id: 12345,
        email: 'learner@example.com', // lowercase
        first_name: 'Test',
        last_name: 'Learner'
      }
    })

    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.result.success).toBe(true)

    // Verify points were awarded despite case difference
    const pointsEntry = await testDb.prisma.pointsLedger.findFirst({
      where: { user_id: testUser.id }
    })
    expect(pointsEntry).toBeDefined()
  })

  it('should handle duplicate webhooks idempotently', async () => {
    const webhookPayload = TestData.kajabiEvent({
      event_id: 'kajabi_duplicate_test',
      contact: {
        id: 12345,
        email: 'learner@example.com'
      }
    })

    const request1 = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const request2 = createWebhookRequest('/api/kajabi/webhook', webhookPayload)

    // Process first webhook
    const response1 = await executeApiRoute(webhookHandler, request1)
    expect(response1.status).toBe(200)

    // Process duplicate webhook
    const response2 = await executeApiRoute(webhookHandler, request2)
    expect(response2.status).toBe(200)

    const data2 = await response2.json()
    expect(data2.data.result.reason).toBe('already_processed')

    // Verify only one points entry exists
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: {
        user_id: testUser.id,
        external_event_id: 'kajabi_duplicate_test'
      }
    })
    expect(pointsEntries).toHaveLength(1)
  })

  it('should handle user not found gracefully', async () => {
    const webhookPayload = TestData.kajabiEvent({
      event_id: 'kajabi_user_not_found',
      contact: {
        id: 99999,
        email: 'nonexistent@example.com', // User doesn't exist
        first_name: 'Non',
        last_name: 'Existent'
      }
    })

    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.result.success).toBe(false)
    expect(data.data.result.reason).toBe('user_not_found')

    // Verify event was stored for manual review
    const kajabiEvent = await testDb.prisma.kajabiEvent.findUnique({
      where: { id: 'kajabi_user_not_found' }
    })

    expect(kajabiEvent).toBeDefined()
    expect(kajabiEvent?.user_match).toBeNull()
    expect(kajabiEvent?.processed_at).toBeNull()

    // Verify no points were awarded
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { external_event_id: 'kajabi_user_not_found' }
    })
    expect(pointsEntries).toHaveLength(0)
  })

  it('should ignore non-LEARN_COMPLETED tags', async () => {
    const webhookPayload = TestData.kajabiEvent({
      event_id: 'kajabi_other_tag',
      contact: {
        id: 12345,
        email: 'learner@example.com'
      },
      tag: {
        name: 'SOME_OTHER_TAG'
      }
    })

    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.result.success).toBe(true)
    expect(data.data.result.reason).toBe('tag_not_processed')

    // Verify no points were awarded
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: { user_id: testUser.id }
    })
    expect(pointsEntries).toHaveLength(0)
  })

  it('should reject webhooks with invalid signatures', async () => {
    const webhookPayload = TestData.kajabiEvent()
    const body = JSON.stringify(webhookPayload)

    // Create request with invalid signature
    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload, 'wrong-secret')

    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toMatch(/invalid webhook signature/i)
  })

  it('should handle missing webhook signatures', async () => {
    const webhookPayload = TestData.kajabiEvent()
    const body = JSON.stringify(webhookPayload)

    // Create request without signature
    const request = new Request('http://localhost:3000/api/kajabi/webhook', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json'
        // No signature header
      }
    })

    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toMatch(/missing webhook signature/i)
  })

  it('should store unknown event types for audit', async () => {
    const webhookPayload = {
      event_type: 'unknown.event',
      event_id: 'kajabi_unknown_123',
      contact: {
        id: 12345,
        email: 'learner@example.com'
      },
      unknown_data: 'should be stored'
    }

    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.data.message).toMatch(/stored for audit/)

    // Verify event was stored
    const kajabiEvent = await testDb.prisma.kajabiEvent.findUnique({
      where: { id: 'kajabi_unknown_123' }
    })

    expect(kajabiEvent).toBeDefined()
    expect(kajabiEvent?.payload).toMatchObject({
      event_type: 'unknown.event',
      unknown_data: 'should be stored'
    })
  })

  it('should handle webhook processing errors gracefully', async () => {
    // Create user with invalid data to cause processing error
    const problemUser = await testDb.fixtures.createTestUser({
      email: 'problem@example.com',
      kajabi_contact_id: null
    })

    // Mock a processing error by making the activity not found
    await testDb.prisma.activity.deleteMany({
      where: { code: 'LEARN' }
    })

    const webhookPayload = TestData.kajabiEvent({
      event_id: 'kajabi_error_test',
      contact: {
        id: 54321,
        email: 'problem@example.com'
      }
    })

    const request = createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    const response = await executeApiRoute(webhookHandler, request)

    // Should still return 500 for processing errors
    expect(response.status).toBe(500)

    // But the event should be stored for review
    const kajabiEvent = await testDb.prisma.kajabiEvent.findUnique({
      where: { id: 'kajabi_error_test' }
    })

    expect(kajabiEvent).toBeDefined()
    expect(kajabiEvent?.processed_at).toBeNull() // Failed processing
  })

  it('should handle race conditions with concurrent webhooks', async () => {
    const webhookPayload = TestData.kajabiEvent({
      event_id: 'kajabi_race_condition',
      contact: {
        id: 12345,
        email: 'learner@example.com'
      }
    })

    // Create multiple identical requests
    const requests = [
      createWebhookRequest('/api/kajabi/webhook', webhookPayload),
      createWebhookRequest('/api/kajabi/webhook', webhookPayload),
      createWebhookRequest('/api/kajabi/webhook', webhookPayload)
    ]

    // Process concurrently
    const responses = await Promise.all(
      requests.map(request => executeApiRoute(webhookHandler, request))
    )

    // All should succeed (some will be duplicates)
    responses.forEach(response => {
      expect(response.status).toBe(200)
    })

    // But only one points entry should exist
    const pointsEntries = await testDb.prisma.pointsLedger.findMany({
      where: {
        user_id: testUser.id,
        external_event_id: 'kajabi_race_condition'
      }
    })

    expect(pointsEntries).toHaveLength(1)
  })

  it('should validate webhook payload structure', async () => {
    const invalidPayload = {
      // Missing required fields
      event_type: 'contact.tagged'
      // Missing event_id, contact, tag
    }

    const request = createWebhookRequest('/api/kajabi/webhook', invalidPayload)
    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error).toMatch(/validation/i)
  })

  it('should handle malformed JSON gracefully', async () => {
    const request = new Request('http://localhost:3000/api/kajabi/webhook', {
      method: 'POST',
      body: 'invalid json{',
      headers: {
        'Content-Type': 'application/json',
        'x-kajabi-signature': crypto
          .createHmac('sha256', 'test-webhook-secret-123')
          .update('invalid json{')
          .digest('hex')
      }
    })

    const response = await executeApiRoute(webhookHandler, request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/invalid json/i)
  })
})
