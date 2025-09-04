import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  cors,
  securityHeaders,
  rateLimit,
  withApiErrorHandling,
  compose,
  type ApiContext
} from '../middleware.js'
import { ElevateApiError } from '@elevate/types'

// Mock environment variables
const mockEnv = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_SITE_URL: 'https://test.com'
}

beforeEach(() => {
  vi.stubGlobal('process', {
    ...process,
    env: { ...process.env, ...mockEnv }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CORS Middleware Security Tests', () => {
  const createRequest = (method: string, origin?: string, headers?: Record<string, string>) => {
    const url = 'https://api.example.com/test'
    const request = new NextRequest(url, { 
      method,
      headers: new Headers({
        ...(origin && { origin }),
        ...headers
      })
    })
    return request
  }

  const createContext = (request: NextRequest): ApiContext => ({
    traceId: 'test-trace-id',
    startTime: Date.now(),
    request
  })

  const mockNext = vi.fn().mockResolvedValue(new NextResponse('OK'))

  beforeEach(() => {
    mockNext.mockClear()
  })

  describe('Critical Security: Wildcard + Credentials Protection', () => {
    it('should throw error when wildcard origin used with credentials=true', () => {
      expect(() => {
        cors({ origin: '*', credentials: true })
      }).toThrow('CORS Security Error: Cannot use wildcard origin (*) with credentials=true')
    })

    it('should throw error when wildcard in origin array used with credentials=true', () => {
      expect(() => {
        cors({ origin: ['https://example.com', '*'], credentials: true })
      }).toThrow('CORS Security Error: Cannot use wildcard origin (*) with credentials=true')
    })

    it('should allow wildcard origin when credentials=false (default)', async () => {
      const corsMiddleware = cors({ origin: '*' })
      const request = createRequest('OPTIONS', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    })

    it('should allow wildcard origin when credentials explicitly false', async () => {
      const corsMiddleware = cors({ origin: '*', credentials: false })
      const request = createRequest('OPTIONS', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    })
  })

  describe('Origin Validation', () => {
    it('should allow request from explicitly allowed origin', async () => {
      const corsMiddleware = cors({ 
        origin: ['https://example.com', 'https://app.example.com'],
        credentials: true 
      })
      const request = createRequest('GET', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('should reject request from non-allowed origin when credentials enabled', async () => {
      const corsMiddleware = cors({ 
        origin: ['https://example.com'],
        credentials: true 
      })
      const request = createRequest('GET', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    })

    it('should handle missing origin header gracefully', async () => {
      const corsMiddleware = cors({ 
        origin: ['https://example.com'],
        credentials: true 
      })
      const request = createRequest('GET') // No origin header
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should handle single origin string parameter', async () => {
      const corsMiddleware = cors({ 
        origin: 'https://example.com',
        credentials: true 
      })
      const request = createRequest('GET', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })
  })

  describe('Vary Header Requirements', () => {
    it('should always include Vary: Origin header for OPTIONS requests', async () => {
      const corsMiddleware = cors({ origin: ['https://example.com'] })
      const request = createRequest('OPTIONS', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Vary')).toBe('Origin')
    })

    it('should always include Vary: Origin header for regular requests', async () => {
      const corsMiddleware = cors({ origin: ['https://example.com'] })
      const request = createRequest('GET', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Vary')).toBe('Origin')
    })

    it('should include Vary header even when origin is rejected', async () => {
      const corsMiddleware = cors({ origin: ['https://example.com'] })
      const request = createRequest('GET', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Vary')).toBe('Origin')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('Preflight OPTIONS Handling', () => {
    it('should handle preflight requests correctly', async () => {
      const corsMiddleware = cors({ 
        origin: ['https://example.com'],
        methods: ['GET', 'POST', 'PUT'],
        headers: ['Content-Type', 'Authorization'],
        credentials: true
      })
      const request = createRequest('OPTIONS', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(response.headers.get('Vary')).toBe('Origin')
      
      // Should not call next() for OPTIONS requests
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject preflight from invalid origin', async () => {
      const corsMiddleware = cors({ 
        origin: ['https://example.com'],
        credentials: true
      })
      const request = createRequest('OPTIONS', 'https://attacker.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      expect(response.headers.get('Vary')).toBe('Origin')
    })
  })

  describe('Environment-Based Origin Configuration', () => {
    it('should use production origins in production environment', async () => {
      vi.stubGlobal('process', {
        ...process,
        env: { 
          ...process.env, 
          NODE_ENV: 'production',
          NEXT_PUBLIC_SITE_URL: 'https://leaps.mereka.org'
        }
      })

      const corsMiddleware = cors() // Uses default origin detection
      const request = createRequest('GET', 'https://leaps.mereka.org')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://leaps.mereka.org')
    })

    it('should reject localhost in production environment', async () => {
      vi.stubGlobal('process', {
        ...process,
        env: { 
          ...process.env, 
          NODE_ENV: 'production',
          NEXT_PUBLIC_SITE_URL: 'https://leaps.mereka.org'
        }
      })

      const corsMiddleware = cors() // Uses default origin detection
      const request = createRequest('GET', 'http://localhost:3000')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should allow localhost in development environment', async () => {
      vi.stubGlobal('process', {
        ...process,
        env: { 
          ...process.env, 
          NODE_ENV: 'development'
        }
      })

      const corsMiddleware = cors() // Uses default origin detection
      const request = createRequest('GET', 'http://localhost:3000')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    })
  })

  describe('Headers Configuration', () => {
    it('should set custom allowed headers', async () => {
      const corsMiddleware = cors({
        origin: ['https://example.com'],
        headers: ['Custom-Header', 'Another-Header']
      })
      const request = createRequest('OPTIONS', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Custom-Header, Another-Header')
    })

    it('should set custom allowed methods', async () => {
      const corsMiddleware = cors({
        origin: ['https://example.com'],
        methods: ['GET', 'POST']
      })
      const request = createRequest('OPTIONS', 'https://example.com')
      const context = createContext(request)

      const response = await corsMiddleware(request, context, mockNext)

      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST')
    })
  })

  describe('Integration with Other Middleware', () => {
    it('should work with middleware composition', async () => {
      const corsMiddleware = cors({ origin: ['https://example.com'] })
      const middleware = compose(corsMiddleware)
      
      const handler = vi.fn().mockResolvedValue(new NextResponse('Success'))
      const composedHandler = middleware(handler)
      
      const request = createRequest('GET', 'https://example.com')
      const response = await composedHandler(request)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response.headers.get('Vary')).toBe('Origin')
      expect(handler).toHaveBeenCalled()
    })

    it('should handle errors in downstream middleware', async () => {
      const corsMiddleware = cors({ origin: ['https://example.com'] })
      const errorMiddleware = vi.fn().mockRejectedValue(new Error('Test error'))
      const middleware = compose(corsMiddleware)
      
      const composedHandler = middleware(errorMiddleware)
      
      const request = createRequest('GET', 'https://example.com')
      const response = await composedHandler(request)

      expect(response.status).toBe(500)
      expect(response.headers.get('X-Trace-Id')).toBeDefined()
    })
  })
})

describe('Security Headers Middleware Tests', () => {
  const createRequest = (url: string = 'https://api.example.com/test') => {
    return new NextRequest(url, { method: 'GET' })
  }

  const createContext = (request: NextRequest): ApiContext => ({
    traceId: 'test-trace-id',
    startTime: Date.now(),
    request
  })

  const mockNext = vi.fn().mockResolvedValue(new NextResponse('OK'))

  beforeEach(() => {
    mockNext.mockClear()
  })

  it('should add core security headers', async () => {
    const middleware = securityHeaders()
    const request = createRequest()
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('should add comprehensive Permissions Policy', async () => {
    const middleware = securityHeaders()
    const request = createRequest()
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    const permissionsPolicy = response.headers.get('Permissions-Policy')
    expect(permissionsPolicy).toContain('camera=()')
    expect(permissionsPolicy).toContain('microphone=()')
    expect(permissionsPolicy).toContain('geolocation=()')
    expect(permissionsPolicy).toContain('interest-cohort=()')
  })

  it('should add HSTS in production', async () => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...process.env, NODE_ENV: 'production' }
    })

    const middleware = securityHeaders()
    const request = createRequest()
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
  })

  it('should not add HSTS in development', async () => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...process.env, NODE_ENV: 'development' }
    })

    const middleware = securityHeaders()
    const request = createRequest()
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    expect(response.headers.get('Strict-Transport-Security')).toBeNull()
  })

  it('should remove server fingerprinting headers', async () => {
    const middleware = securityHeaders()
    const request = createRequest()
    const context = createContext(request)

    // Mock response with fingerprinting headers
    const responseWithHeaders = new NextResponse('OK')
    responseWithHeaders.headers.set('Server', 'Apache/2.4.1')
    responseWithHeaders.headers.set('X-Powered-By', 'Express')
    responseWithHeaders.headers.set('Via', 'Proxy/1.0')

    mockNext.mockResolvedValueOnce(responseWithHeaders)

    const response = await middleware(request, context, mockNext)

    expect(response.headers.get('Server')).toBeNull()
    expect(response.headers.get('X-Powered-By')).toBeNull()
    expect(response.headers.get('Via')).toBeNull()
  })

  it('should add no-cache headers for API routes', async () => {
    const middleware = securityHeaders()
    const request = createRequest('https://api.example.com/api/test')
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate, private')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })
})

describe('Rate Limit Middleware Tests', () => {
  const createRequest = (ip?: string) => {
    const request = new NextRequest('https://api.example.com/test', { method: 'GET' })
    if (ip) {
      // Mock IP in request headers
      Object.defineProperty(request, 'headers', {
        value: new Headers({ 'x-forwarded-for': ip }),
        writable: false
      })
    }
    return request
  }

  const createContext = (request: NextRequest): ApiContext => ({
    traceId: 'test-trace-id',
    startTime: Date.now(),
    request
  })

  const mockNext = vi.fn().mockResolvedValue(new NextResponse('OK'))

  beforeEach(() => {
    mockNext.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should allow requests within rate limit', async () => {
    const middleware = rateLimit(5, 60000) // 5 requests per minute
    const request = createRequest('127.0.0.1')
    const context = createContext(request)

    const response = await middleware(request, context, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(response).toBeDefined()
  })

  it('should block requests exceeding rate limit', async () => {
    const middleware = rateLimit(2, 60000) // 2 requests per minute
    const request = createRequest('127.0.0.1')
    const context = createContext(request)

    // First two requests should pass
    await middleware(request, context, mockNext)
    await middleware(request, context, mockNext)

    // Third request should be blocked
    await expect(
      middleware(request, context, mockNext)
    ).rejects.toThrow('Rate limit exceeded')
  })

  it('should reset rate limit after window expires', async () => {
    const middleware = rateLimit(1, 60000) // 1 request per minute
    const request = createRequest('127.0.0.1')
    const context = createContext(request)

    // First request should pass
    await middleware(request, context, mockNext)

    // Second request should be blocked
    await expect(
      middleware(request, context, mockNext)
    ).rejects.toThrow('Rate limit exceeded')

    // Fast-forward time past the window
    vi.advanceTimersByTime(61000)

    // Request should now pass again
    mockNext.mockClear()
    const response = await middleware(request, context, mockNext)
    expect(mockNext).toHaveBeenCalled()
  })

  it('should handle different IPs independently', async () => {
    const middleware = rateLimit(1, 60000) // 1 request per minute
    
    const request1 = createRequest('127.0.0.1')
    const context1 = createContext(request1)
    
    const request2 = createRequest('192.168.1.1')
    const context2 = createContext(request2)

    // Both IPs should be allowed their first request
    await middleware(request1, context1, mockNext)
    await middleware(request2, context2, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(2)
  })

  it('should include retry-after information in error', async () => {
    const middleware = rateLimit(1, 60000) // 1 request per minute
    const request = createRequest('127.0.0.1')
    const context = createContext(request)

    // First request passes
    await middleware(request, context, mockNext)

    // Second request should include retry information
    try {
      await middleware(request, context, mockNext)
      expect.fail('Expected rate limit error')
    } catch (error) {
      expect(error).toBeInstanceOf(ElevateApiError)
      const elevateError = error as ElevateApiError
      expect(elevateError.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(elevateError.details).toHaveProperty('retryAfter')
      expect(elevateError.details?.retryAfter).toBeGreaterThan(0)
    }
  })
})

describe('Error Handling Middleware Tests', () => {
  const createRequest = () => new NextRequest('https://api.example.com/test', { method: 'GET' })

  it('should add trace ID to successful responses', async () => {
    const handler = vi.fn().mockResolvedValue(new NextResponse('Success'))
    const wrappedHandler = withApiErrorHandling(handler)
    const request = createRequest()

    const response = await wrappedHandler(request)

    expect(response.headers.get('X-Trace-Id')).toMatch(/^trace_\d+_[a-z0-9]+$/)
    expect(handler).toHaveBeenCalled()
  })

  it('should handle errors and return error response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Test error'))
    const wrappedHandler = withApiErrorHandling(handler)
    const request = createRequest()

    const response = await wrappedHandler(request)

    expect(response.status).toBe(500)
    expect(response.headers.get('X-Trace-Id')).toBeDefined()
    
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    expect(body.traceId).toBeDefined()
  })

  it('should log slow API calls', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100)) // Simulate slow request
      return new NextResponse('Success')
    })
    const wrappedHandler = withApiErrorHandling(handler)
    const request = createRequest()

    vi.useRealTimers() // Need real timers for actual delay
    await wrappedHandler(request)
    vi.useFakeTimers()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SLOW API]'),
      expect.objectContaining({
        duration: expect.any(Number),
        traceId: expect.any(String)
      })
    )

    consoleSpy.mockRestore()
  })

  it('should handle ElevateApiError instances', async () => {
    const error = new ElevateApiError('Custom error', 'CUSTOM_ERROR', { test: 'data' })
    const handler = vi.fn().mockRejectedValue(error)
    const wrappedHandler = withApiErrorHandling(handler)
    const request = createRequest()

    const response = await wrappedHandler(request)

    expect(response.status).toBe(400) // Default status for ElevateApiError
    
    const body = await response.json()
    expect(body.code).toBe('CUSTOM_ERROR')
    expect(body.error).toBe('Custom error')
  })
})

describe('Middleware Composition Tests', () => {
  const createRequest = (origin?: string) => {
    return new NextRequest('https://api.example.com/test', { 
      method: 'GET',
      headers: origin ? new Headers({ origin }) : undefined
    })
  }

  it('should compose multiple middleware correctly', async () => {
    const corsMiddleware = cors({ origin: ['https://example.com'] })
    const securityMiddleware = securityHeaders()
    const handler = vi.fn().mockResolvedValue(new NextResponse('Success'))
    
    const composedHandler = compose(corsMiddleware, securityMiddleware)(handler)
    const request = createRequest('https://example.com')

    const response = await composedHandler(request)

    // Should have both CORS and security headers
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Vary')).toBe('Origin')
    expect(handler).toHaveBeenCalled()
  })

  it('should handle middleware errors in composition', async () => {
    const errorMiddleware = vi.fn().mockRejectedValue(new Error('Middleware error'))
    const handler = vi.fn().mockResolvedValue(new NextResponse('Success'))
    
    const composedHandler = compose(errorMiddleware)(handler)
    const request = createRequest()

    const response = await composedHandler(request)

    expect(response.status).toBe(500)
    expect(handler).not.toHaveBeenCalled()
  })

  it('should execute middleware in correct order', async () => {
    const executionOrder: number[] = []
    
    const middleware1 = vi.fn().mockImplementation(async (req, ctx, next) => {
      executionOrder.push(1)
      const response = await next()
      executionOrder.push(4)
      return response
    })
    
    const middleware2 = vi.fn().mockImplementation(async (req, ctx, next) => {
      executionOrder.push(2)
      const response = await next()
      executionOrder.push(3)
      return response
    })
    
    const handler = vi.fn().mockImplementation(async () => {
      executionOrder.push(5)
      return new NextResponse('Success')
    })
    
    const composedHandler = compose(middleware1, middleware2)(handler)
    const request = createRequest()

    await composedHandler(request)

    expect(executionOrder).toEqual([1, 2, 5, 3, 4])
  })
})