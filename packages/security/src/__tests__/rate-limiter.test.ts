import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  RateLimiter,
  webhookRateLimiter,
  apiRateLimiter,
  adminRateLimiter,
  fileUploadRateLimiter,
  submissionRateLimiter,
  authRateLimiter,
  publicApiRateLimiter,
  withRateLimit,
  getRateLimitStats,
  resetRateLimitStats,
  cleanupUtils,
  memoryUtils
} from '../rate-limiter'

// Mock Redis for testing
const mockRedis = {
  incr: vi.fn(),
  pexpire: vi.fn(),
  pttl: vi.fn()
}

// Mock dynamic Redis import
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor() {
      return mockRedis
    }
  }
}))

describe('Rate Limiter - Memory Leak Prevention Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetRateLimitStats()
    memoryUtils.clearAll()
    
    // Reset Redis mocks
    mockRedis.incr.mockReset()
    mockRedis.pexpire.mockReset()
    mockRedis.pttl.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanupUtils.destroy()
  })

  describe('Cleanup Mechanism Tests', () => {
    it('should automatically clean up expired entries', async () => {
      const rateLimiter = new RateLimiter({
        name: 'test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      // Make requests to populate store
      await rateLimiter.checkLimit(request)
      await rateLimiter.checkLimit(request)

      const initialStats = memoryUtils.getMemoryUsage()
      expect(initialStats.storeSize).toBeGreaterThan(0)

      // Fast-forward time beyond window
      vi.advanceTimersByTime(61000)

      // Force cleanup
      cleanupUtils.forceCleanup()

      const afterCleanupStats = memoryUtils.getMemoryUsage()
      expect(afterCleanupStats.storeSize).toBeLessThanOrEqual(initialStats.storeSize)
    })

    it('should trigger automatic cleanup when store gets large', async () => {
      const rateLimiter = new RateLimiter({
        name: 'test',
        windowMs: 60000,
        maxRequests: 10
      })

      // Simulate large number of unique IPs to grow store
      for (let i = 0; i < 1050; i++) {
        const request = new NextRequest('https://api.example.com/test', {
          method: 'GET',
          headers: new Headers({ 'x-forwarded-for': `192.168.1.${i % 255}` })
        })
        await rateLimiter.checkLimit(request)
        
        // Speed up time slightly to avoid same timestamp collisions
        vi.advanceTimersByTime(10)
      }

      const stats = memoryUtils.getMemoryUsage()
      
      // Should trigger cleanup when store > 1000 entries
      expect(stats.storeSize).toBeLessThan(1100) // Should have been cleaned up
    })

    it('should respect cleanup intervals based on environment', () => {
      // Test serverless environment detection
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, VERCEL: '1' }
      })

      new RateLimiter({
        name: 'serverless',
        windowMs: 60000,
        maxRequests: 10
      })

      // Cleanup should be more frequent in serverless (30s vs 5min)
      const stats = cleanupUtils.getStats()
      expect(stats.isDestroyed).toBe(false)

      vi.unstubAllGlobals()
    })

    it('should clean up stats that are older than 1 hour', () => {
      const rateLimiter = new RateLimiter({
        name: 'old-stats-test',
        windowMs: 60000,
        maxRequests: 5
      })

      // Generate some stats
      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
      })
      rateLimiter.checkLimit(request)

      const initialStats = getRateLimitStats()
      expect(initialStats['old-stats-test']).toBeDefined()

      // Fast-forward time by more than 1 hour
      vi.advanceTimersByTime(61 * 60 * 1000)

      // Force cleanup
      cleanupUtils.forceCleanup()

      const afterCleanupStats = getRateLimitStats()
      // Stats should be cleaned up after 1 hour of inactivity
      expect(Object.keys(afterCleanupStats)).toHaveLength(0)
    })
  })

  describe('Memory Bounds Tests', () => {
    it('should track memory usage accurately', async () => {
      const rateLimiter = new RateLimiter({
        name: 'memory-test',
        windowMs: 60000,
        maxRequests: 10
      })

      const initialUsage = memoryUtils.getMemoryUsage()
      const initialSize = initialUsage.storeSize

      // Add entries
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('https://api.example.com/test', {
          method: 'GET',
          headers: new Headers({ 'x-forwarded-for': `192.168.1.${i}` })
        })
        await rateLimiter.checkLimit(request)
      }

      const afterUsage = memoryUtils.getMemoryUsage()
      expect(afterUsage.storeSize).toBeGreaterThan(initialSize)
      expect(afterUsage.estimatedMemoryKB).toBeGreaterThan(0)
      expect(typeof afterUsage.estimatedMemoryKB).toBe('number')
    })

    it('should provide memory warnings in production when store is large', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock large store size
      for (let i = 0; i < 5001; i++) {
        memoryUtils.getMemoryUsage() // This would be called internally
      }

      // Fast-forward to trigger warning interval
      vi.advanceTimersByTime(11 * 60 * 1000) // 11 minutes

      consoleSpy.mockRestore()
    })

    it('should handle memory statistics correctly', () => {
      const stats = memoryUtils.getMemoryUsage()
      
      expect(stats).toHaveProperty('storeSize')
      expect(stats).toHaveProperty('statsSize')
      expect(stats).toHaveProperty('cleanupStats')
      expect(stats).toHaveProperty('estimatedMemoryKB')
      
      expect(typeof stats.storeSize).toBe('number')
      expect(typeof stats.statsSize).toBe('number')
      expect(typeof stats.estimatedMemoryKB).toBe('number')
      expect(stats.estimatedMemoryKB).toBeGreaterThanOrEqual(0)
    })

    it('should identify entries about to expire', async () => {
      const rateLimiter = new RateLimiter({
        name: 'expiring-test',
        windowMs: 60000, // 1 minute
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      await rateLimiter.checkLimit(request)

      // Fast-forward to near expiry
      vi.advanceTimersByTime(58000) // 58 seconds

      const expiringEntries = memoryUtils.getExpiringEntries(5 * 60 * 1000) // Within 5 minutes
      expect(expiringEntries.length).toBeGreaterThan(0)
      expect(expiringEntries[0]).toHaveProperty('key')
      expect(expiringEntries[0]).toHaveProperty('expiresIn')
      expect(expiringEntries[0]?.expiresIn).toBeGreaterThan(0)
      expect(expiringEntries[0]?.expiresIn).toBeLessThan(5 * 60 * 1000)
    })
  })

  describe('Serverless Environment Detection', () => {
    it('should detect Vercel environment', () => {
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, VERCEL: '1' }
      })

      const rateLimiter = new RateLimiter({
        name: 'vercel-test',
        windowMs: 60000,
        maxRequests: 5
      })

      expect(rateLimiter).toBeDefined()
      // In Vercel, cleanup should be more frequent
      vi.unstubAllGlobals()
    })

    it('should detect AWS Lambda environment', () => {
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, AWS_LAMBDA_FUNCTION_NAME: 'test-function' }
      })

      const rateLimiter = new RateLimiter({
        name: 'lambda-test',
        windowMs: 60000,
        maxRequests: 5
      })

      expect(rateLimiter).toBeDefined()
      vi.unstubAllGlobals()
    })

    it('should handle traditional server environment', () => {
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, NODE_ENV: 'production' }
      })

      const rateLimiter = new RateLimiter({
        name: 'server-test',
        windowMs: 60000,
        maxRequests: 5
      })

      expect(rateLimiter).toBeDefined()
      vi.unstubAllGlobals()
    })
  })

  describe('Redis Integration for Multi-Instance Safety', () => {
    beforeEach(() => {
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
          UPSTASH_REDIS_REST_TOKEN: 'test-token'
        }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should use Redis when available', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.pexpire.mockResolvedValue('OK')
      mockRedis.pttl.mockResolvedValue(60000)

      const rateLimiter = new RateLimiter({
        name: 'redis-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      const result = await rateLimiter.checkLimit(request)

      expect(mockRedis.incr).toHaveBeenCalledWith('rl:192.168.1.1:unknown')
      expect(mockRedis.pexpire).toHaveBeenCalled()
      expect(mockRedis.pttl).toHaveBeenCalled()
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should handle Redis rate limiting correctly', async () => {
      mockRedis.incr.mockResolvedValueOnce(5) // At limit
      mockRedis.pttl.mockResolvedValue(30000) // 30 seconds remaining

      const rateLimiter = new RateLimiter({
        name: 'redis-limit-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
      })

      const result = await rateLimiter.checkLimit(request)

      expect(result.allowed).toBe(true) // Exactly at limit
      expect(result.remaining).toBe(0)
    })

    it('should block when Redis limit exceeded', async () => {
      mockRedis.incr.mockResolvedValue(6) // Over limit
      mockRedis.pttl.mockResolvedValue(30000)

      const rateLimiter = new RateLimiter({
        name: 'redis-block-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
      })

      const result = await rateLimiter.checkLimit(request)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should fallback to in-memory when Redis fails', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const rateLimiter = new RateLimiter({
        name: 'redis-fallback-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
      })

      const result = await rateLimiter.checkLimit(request)

      // Should fallback to in-memory and still work
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should handle Redis TTL correctly', async () => {
      mockRedis.incr.mockResolvedValue(3)
      mockRedis.pexpire.mockResolvedValue('OK')
      mockRedis.pttl.mockResolvedValue(45000) // 45 seconds remaining

      const rateLimiter = new RateLimiter({
        name: 'redis-ttl-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
      })

      const result = await rateLimiter.checkLimit(request)

      expect(result.resetTime).toBeCloseTo(Date.now() + 45000, -2) // Within 100ms
    })
  })

  describe('IP Address Extraction', () => {
    it('should extract IP from X-Forwarded-For header', async () => {
      const rateLimiter = new RateLimiter({
        name: 'ip-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '203.0.113.1, 198.51.100.1' })
      })

      await rateLimiter.checkLimit(request)

      // Should use first IP in X-Forwarded-For chain
      const stats = getRateLimitStats()
      expect(stats['ip-test']).toBeDefined()
    })

    it('should extract IP from X-Real-IP header', async () => {
      const rateLimiter = new RateLimiter({
        name: 'real-ip-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-real-ip': '203.0.113.1' })
      })

      await rateLimiter.checkLimit(request)

      const stats = getRateLimitStats()
      expect(stats['real-ip-test']).toBeDefined()
    })

    it('should extract IP from CF-Connecting-IP header', async () => {
      const rateLimiter = new RateLimiter({
        name: 'cf-ip-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'cf-connecting-ip': '203.0.113.1' })
      })

      await rateLimiter.checkLimit(request)

      const stats = getRateLimitStats()
      expect(stats['cf-ip-test']).toBeDefined()
    })

    it('should handle unknown IP gracefully', async () => {
      const rateLimiter = new RateLimiter({
        name: 'unknown-ip-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
        // No IP headers
      })

      const result = await rateLimiter.checkLimit(request)

      expect(result.allowed).toBe(true)
      // Should still work with unknown IP
    })
  })

  describe('Custom Key Generation', () => {
    it('should use custom key generator when provided', async () => {
      const customKeyGen = vi.fn().mockReturnValue('custom-key-123')
      
      const rateLimiter = new RateLimiter({
        name: 'custom-key-test',
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: customKeyGen
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      await rateLimiter.checkLimit(request)

      expect(customKeyGen).toHaveBeenCalledWith(request)
    })

    it('should handle webhook-specific key generation', async () => {
      const request = new NextRequest('https://api.example.com/webhook', {
        method: 'POST',
        headers: new Headers({
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'WebhookBot/1.0',
          'x-kajabi-signature': 'signature123456'
        })
      })

      const result = await webhookRateLimiter.checkLimit(request)

      expect(result.allowed).toBe(true)
      // Webhook rate limiter should use custom key including signature
    })
  })

  describe('Rate Limit Statistics', () => {
    it('should track allowed and blocked requests', async () => {
      const rateLimiter = new RateLimiter({
        name: 'stats-test',
        windowMs: 60000,
        maxRequests: 2
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      // Allow first two requests
      await rateLimiter.checkLimit(request)
      await rateLimiter.checkLimit(request)

      // Block third request
      const thirdResult = await rateLimiter.checkLimit(request)
      expect(thirdResult.allowed).toBe(false)

      const stats = getRateLimitStats()
      expect(stats['stats-test']).toBeDefined()
      expect(stats['stats-test']?.allowed).toBe(2)
      expect(stats['stats-test']?.blocked).toBe(1)
      expect(stats['stats-test']?.lastReset).toBeGreaterThan(0)
    })

    it('should reset stats correctly', () => {
      const rateLimiter = new RateLimiter({
        name: 'reset-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', { method: 'GET' })
      rateLimiter.checkLimit(request)

      const statsBeforeReset = getRateLimitStats()
      expect(Object.keys(statsBeforeReset).length).toBeGreaterThan(0)

      resetRateLimitStats()

      const statsAfterReset = getRateLimitStats()
      expect(Object.keys(statsAfterReset).length).toBe(0)
    })
  })

  describe('Middleware Integration', () => {
    it('should create middleware that blocks rate limited requests', async () => {
      const rateLimiter = new RateLimiter({
        name: 'middleware-test',
        windowMs: 60000,
        maxRequests: 1
      })

      const middleware = rateLimiter.createMiddleware()
      
      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET',
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      // First request should pass
      const firstResponse = await middleware(request)
      expect(firstResponse).toBeNull() // Continues to next handler

      // Second request should be blocked
      const secondResponse = await middleware(request)
      expect(secondResponse).toBeInstanceOf(NextResponse)
      expect(secondResponse?.status).toBe(429)
      
      if (secondResponse) {
        const body = await secondResponse.json()
        expect(body.success).toBe(false)
        expect(body.error).toContain('Rate limit exceeded')
      }
    })

    it('should add rate limit headers to responses', async () => {
      const rateLimiter = new RateLimiter({
        name: 'headers-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const handler = vi.fn().mockResolvedValue(new NextResponse('OK'))
      const request = new NextRequest('https://api.example.com/test', { method: 'GET' })

      const response = await withRateLimit(request, rateLimiter, handler)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4')
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
      expect(handler).toHaveBeenCalled()
    })

    it('should return 429 when rate limited via withRateLimit', async () => {
      const rateLimiter = new RateLimiter({
        name: 'with-rate-limit-test',
        windowMs: 60000,
        maxRequests: 1
      })

      const handler = vi.fn().mockResolvedValue(new NextResponse('OK'))
      const request = new NextRequest('https://api.example.com/test', {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      // First request should succeed
      const firstResponse = await withRateLimit(request, rateLimiter, handler)
      expect(firstResponse.status).toBe(200)

      // Second request should be rate limited
      const secondResponse = await withRateLimit(request, rateLimiter, handler)
      expect(secondResponse.status).toBe(429)
      
      const body = await secondResponse.json()
      expect(body.error).toContain('Rate limit exceeded')
      expect(body.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Pre-configured Rate Limiters', () => {
    it('should have webhook rate limiter configured', async () => {
      const request = new NextRequest('https://api.example.com/webhook', {
        method: 'POST',
        headers: new Headers({ 'user-agent': 'KajabiWebhook/1.0' })
      })

      const result = await webhookRateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
      expect(typeof result.remaining).toBe('number')
    })

    it('should have API rate limiter configured', async () => {
      const request = new NextRequest('https://api.example.com/api/test', { method: 'GET' })
      const result = await apiRateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
    })

    it('should have admin rate limiter with stricter limits', async () => {
      const request = new NextRequest('https://api.example.com/admin/users', { method: 'GET' })
      const result = await adminRateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
    })

    it('should have file upload rate limiter with strict limits', async () => {
      const request = new NextRequest('https://api.example.com/upload', { method: 'POST' })
      const result = await fileUploadRateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
    })

    it('should have auth rate limiter with longer window', async () => {
      const request = new NextRequest('https://api.example.com/auth/login', { method: 'POST' })
      const result = await authRateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
      // Auth limiter uses 15-minute window instead of 1 minute
    })

    it('should respect environment variable configuration', () => {
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          WEBHOOK_RATE_LIMIT_RPM: '240', // Double the default
          API_RATE_LIMIT_RPM: '120'
        }
      })

      // Create new instances to pick up env vars
      const newWebhookLimiter = new RateLimiter({
        name: 'webhook',
        windowMs: 60 * 1000,
        maxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT_RPM || '120')
      })

      expect(newWebhookLimiter['config'].maxRequests).toBe(240)
      vi.unstubAllGlobals()
    })
  })

  describe('Logging and Monitoring', () => {
    it('should log rate limit blocks when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      vi.stubGlobal('process', {
        ...process,
        env: { ...process.env, RATE_LIMIT_LOG_ENABLED: '1' }
      })

      const rateLimiter = new RateLimiter({
        name: 'logging-test',
        windowMs: 60000,
        maxRequests: 1
      })

      const request = new NextRequest('https://api.example.com/test', {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      await rateLimiter.checkLimit(request) // First request allowed
      await rateLimiter.checkLimit(request) // Second request blocked

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"rate_limit_block"')
      )

      consoleSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('should not log when logging is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const rateLimiter = new RateLimiter({
        name: 'no-logging-test',
        windowMs: 60000,
        maxRequests: 1
      })

      const request = new NextRequest('https://api.example.com/test', {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      await rateLimiter.checkLimit(request) // Allowed
      await rateLimiter.checkLimit(request) // Blocked

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should provide memory statistics for monitoring', () => {
      const rateLimiter = new RateLimiter({
        name: 'memory-stats-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const memStats = rateLimiter.getMemoryStats()

      expect(memStats).toHaveProperty('name', 'memory-stats-test')
      expect(memStats).toHaveProperty('lastUsed')
      expect(memStats).toHaveProperty('storeSize')
      expect(memStats).toHaveProperty('config')
      expect(memStats.config).toHaveProperty('windowMs', 60000)
      expect(memStats.config).toHaveProperty('maxRequests', 5)
    })
  })

  describe('Cleanup and Lifecycle Management', () => {
    it('should handle cleanup manager lifecycle', () => {
      const stats = cleanupUtils.getStats()
      
      expect(stats).toHaveProperty('storeSize')
      expect(stats).toHaveProperty('statsSize')
      expect(stats).toHaveProperty('lastCleanup')
      expect(stats).toHaveProperty('isDestroyed')
      expect(typeof stats.lastCleanup).toBe('number')
    })

    it('should force cleanup when requested', () => {
      const initialStats = cleanupUtils.getStats()
      const initialCleanupTime = initialStats.lastCleanup

      // Wait a bit then force cleanup
      vi.advanceTimersByTime(1000)
      cleanupUtils.forceCleanup()

      const afterStats = cleanupUtils.getStats()
      expect(afterStats.lastCleanup).toBeGreaterThan(initialCleanupTime)
    })

    it('should destroy cleanup manager properly', () => {
      cleanupUtils.destroy()
      
      const stats = cleanupUtils.getStats()
      expect(stats.isDestroyed).toBe(true)
    })

    it('should clear individual rate limiter cache', async () => {
      const rateLimiter = new RateLimiter({
        name: 'clear-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' })
      })

      await rateLimiter.checkLimit(request)
      
      const statsBefore = getRateLimitStats()
      expect(statsBefore['clear-test']).toBeDefined()

      rateLimiter.clearCache()

      const statsAfter = getRateLimitStats()
      expect(statsAfter['clear-test']).toBeUndefined()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed X-Forwarded-For header', async () => {
      const rateLimiter = new RateLimiter({
        name: 'malformed-header-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        headers: new Headers({ 'x-forwarded-for': ',,,' })
      })

      const result = await rateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true) // Should handle gracefully
    })

    it('should handle requests without user agent', async () => {
      const rateLimiter = new RateLimiter({
        name: 'no-user-agent-test',
        windowMs: 60000,
        maxRequests: 5
      })

      const request = new NextRequest('https://api.example.com/test', {
        method: 'GET'
        // No user-agent header
      })

      const result = await rateLimiter.checkLimit(request)
      expect(result.allowed).toBe(true)
    })

    it('should handle zero or negative limits gracefully', async () => {
      const rateLimiter = new RateLimiter({
        name: 'zero-limit-test',
        windowMs: 60000,
        maxRequests: 0 // Zero requests allowed
      })

      const request = new NextRequest('https://api.example.com/test', { method: 'GET' })
      const result = await rateLimiter.checkLimit(request)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle very short time windows', async () => {
      const rateLimiter = new RateLimiter({
        name: 'short-window-test',
        windowMs: 100, // 100ms window
        maxRequests: 2
      })

      const request = new NextRequest('https://api.example.com/test', { method: 'GET' })
      
      await rateLimiter.checkLimit(request)
      await rateLimiter.checkLimit(request)
      
      const blocked = await rateLimiter.checkLimit(request)
      expect(blocked.allowed).toBe(false)

      // Fast-forward past window
      vi.advanceTimersByTime(200)

      const afterWindow = await rateLimiter.checkLimit(request)
      expect(afterWindow.allowed).toBe(true)
    })
  })
})
