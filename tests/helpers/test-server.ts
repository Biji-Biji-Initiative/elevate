/**
 * Test server helper for integration tests
 * Provides utilities for testing API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { vi } from 'vitest'

export interface MockRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  searchParams?: Record<string, string>
  user?: {
    userId: string
    role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
  }
}

/**
 * Create a mock NextRequest for testing API endpoints
 */
export function createMockRequest(url: string, init: MockRequestInit = {}): NextRequest {
  const {
    method = 'GET',
    body,
    headers = {},
    searchParams = {},
    user
  } = init

  // Build URL with search params
  const fullUrl = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    fullUrl.searchParams.set(key, value)
  })

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }

  if (body && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const request = new NextRequest(fullUrl, requestInit)

  // Mock authentication if user is provided
  if (user) {
    mockAuthentication(user)
  }

  return request
}

/**
 * Mock authentication for a test user
 */
export function mockAuthentication(user: {
  userId: string
  role: 'PARTICIPANT' | 'REVIEWER' | 'ADMIN' | 'SUPERADMIN'
}) {
  const { requireRole } = require('@elevate/auth/server-helpers')
  
  vi.mocked(requireRole).mockImplementation(async (requiredRole: string) => {
    const roleHierarchy = {
      'PARTICIPANT': 0,
      'REVIEWER': 1,
      'ADMIN': 2,
      'SUPERADMIN': 3
    }

    const userLevel = roleHierarchy[user.role]
    const requiredLevel = roleHierarchy[requiredRole.toUpperCase() as keyof typeof roleHierarchy]

    if (userLevel >= requiredLevel) {
      return { userId: user.userId, role: user.role.toLowerCase() }
    } else {
      throw new Error('Insufficient permissions')
    }
  })
}

/**
 * Clear authentication mocks
 */
export function clearAuthenticationMock() {
  const { requireRole } = require('@elevate/auth/server-helpers')
  vi.mocked(requireRole).mockClear()
}

/**
 * Execute an API route handler and return parsed response
 */
export async function executeApiRoute(
  handler: (request: NextRequest, context?: { traceId?: string; params?: Record<string, unknown> }) => Promise<NextResponse>,
  request: NextRequest
): Promise<{
  status: number
  headers: Headers
  json: () => Promise<unknown>
  text: () => Promise<string>
}> {
  const response = await handler(request, { 
    traceId: 'test-trace-id',
    params: {} 
  })

  const responseText = await response.text()

  return {
    status: response.status,
    headers: response.headers,
    json: async () => {
      try {
        return JSON.parse(responseText)
      } catch {
        throw new Error('Response is not valid JSON')
      }
    },
    text: async () => responseText
  }
}

/**
 * Create a mock webhook request with proper signature
 */
export function createWebhookRequest(
  url: string,
  payload: Record<string, unknown>,
  secret = 'test-webhook-secret-123'
): NextRequest {
  const crypto = require('crypto')
  const body = JSON.stringify(payload)
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return createMockRequest(url, {
    method: 'POST',
    body,
    headers: {
      'x-kajabi-signature': signature,
      'content-type': 'application/json'
    }
  })
}

/**
 * Utility to wait for async operations in tests
 */
export function waitForOperation(ms = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Mock file upload for testing
 */
export interface MockFile {
  name: string
  type: string
  size: number
  content: Buffer | string
}

export function createMockFile(file: MockFile): File {
  const buffer = typeof file.content === 'string' 
    ? Buffer.from(file.content) 
    : file.content

  // Create a proper File object for testing
  const mockFile = new File([buffer], file.name, { 
    type: file.type,
    lastModified: Date.now()
  })

  Object.defineProperty(mockFile, 'size', {
    value: file.size,
    writable: false
  })

  return mockFile
}

/**
 * Test data generators
 */
export const TestData = {
  user: (overrides = {}) => ({
    id: `test-user-${Date.now()}`,
    handle: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    role: 'PARTICIPANT' as const,
    school: 'Test School',
    cohort: 'Test Cohort',
    ...overrides
  }),

  submission: (overrides = {}) => ({
    id: `test-submission-${Date.now()}`,
    user_id: 'test-user-1',
    activity_code: 'LEARN',
    status: 'PENDING' as const,
    visibility: 'PRIVATE' as const,
    payload: {
      certificate_url: '/uploads/test-cert.pdf',
      course_name: 'AI Fundamentals',
      completion_date: new Date().toISOString(),
      hash: 'test-hash-123'
    },
    attachments_rel: [{ id: `att-${Date.now()}`, submission_id: 'test-submission-1', path: '/uploads/test-cert.pdf' }],
    reviewer_id: null,
    review_note: null,
    ...overrides
  }),

  kajabiEvent: (overrides = {}) => ({
    event_type: 'contact.tagged',
    event_id: `kajabi-event-${Date.now()}`,
    contact: {
      id: 12345,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User'
    },
    tag: {
      name: 'LEARN_COMPLETED'
    },
    ...overrides
  })
}

const testServerHelpers = {
  createMockRequest,
  mockAuthentication,
  clearAuthenticationMock,
  executeApiRoute,
  createWebhookRequest,
  waitForOperation,
  createMockFile,
  TestData
}

export default testServerHelpers
