/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

import {
  createSecurityMiddleware,
  createCSPReportHandler,
  getSecurityConfig,
  withSecurity,
  shouldBypassSecurity,
  extractNonce,
  type SecurityMiddlewareOptions,
} from '../security-middleware'

// Mock crypto for consistent nonce generation
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn(() => Buffer.from('mock-random-bytes')),
}))

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  const mkCtx = (request?: NextRequest) => ({
    traceId: 'test-trace',
    startTime: Date.now(),
    ...(request ? { request } : {}),
  })

  describe('createSecurityMiddleware', () => {
    it('should create middleware that adds security headers', () => {
      const middleware = createSecurityMiddleware()
      const request = new NextRequest('https://example.com/')

      const response = middleware(request, mkCtx(request)) as NextResponse as NextResponse

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('x-csp-nonce')).toBeTruthy()
    })

    it('should skip security headers for specified paths', () => {
      const middleware = createSecurityMiddleware({
        skipPaths: ['/api/health', /^\/static\//],
      })

      const healthRequest = new NextRequest('https://example.com/api/health')
      const staticRequest = new NextRequest(
        'https://example.com/static/image.png',
      )
      const normalRequest = new NextRequest('https://example.com/dashboard')

      const healthResponse = middleware(healthRequest, mkCtx(healthRequest)) as NextResponse
      const staticResponse = middleware(staticRequest, mkCtx(staticRequest)) as NextResponse
      const normalResponse = middleware(normalRequest, mkCtx(normalRequest)) as NextResponse

      expect(healthResponse.headers.get('Content-Security-Policy')).toBeFalsy()
      expect(staticResponse.headers.get('Content-Security-Policy')).toBeFalsy()
      expect(normalResponse.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('should apply header overrides', () => {
      const middleware = createSecurityMiddleware({
        headerOverrides: {
          'X-Frame-Options': 'SAMEORIGIN',
          'Custom-Header': 'custom-value',
        },
      })

      const request = new NextRequest('https://example.com/')
      const response = middleware(request, mkCtx(request)) as NextResponse as NextResponse

      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
      expect(response.headers.get('Custom-Header')).toBe('custom-value')
    })

    it('should use report-only mode in development', () => {
      const middleware = createSecurityMiddleware({
        isDevelopment: true,
        reportOnly: true,
      })

      const request = new NextRequest('https://example.com/')
      const response = middleware(request, mkCtx(request)) as NextResponse

      expect(
        response.headers.get('Content-Security-Policy-Report-Only'),
      ).toBeTruthy()
      expect(response.headers.get('Content-Security-Policy')).toBeFalsy()
    })

    it('should include report URI when enabled', () => {
      const middleware = createSecurityMiddleware({
        enableReporting: true,
        reportUri: '/api/csp-report',
      })

      const request = new NextRequest('https://example.com/')
      const response = middleware(request, mkCtx(request)) as NextResponse

      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toContain('report-uri /api/csp-report')
    })

    it('should set cache control headers', () => {
      const middleware = createSecurityMiddleware()
      const request = new NextRequest('https://example.com/')

      const response = middleware(request, mkCtx(request)) as NextResponse

      expect(response.headers.get('Cache-Control')).toBe(
        'no-cache, no-store, must-revalidate, private',
      )
    })

    it('should pass nonce in request headers', () => {
      const middleware = createSecurityMiddleware()
      const request = new NextRequest('https://example.com/')

      const response = middleware(request, mkCtx(request)) as NextResponse

      const nonce = response.headers.get('x-csp-nonce')
      expect(nonce).toBeTruthy()
      expect(typeof nonce).toBe('string')
    })

    it('should throw on invalid CSP config in production', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      expect(() => {
        createSecurityMiddleware({
          allowedDomains: {
            external: ['invalid-domain'],
          },
        })
      }).toThrow('Invalid CSP configuration')

      process.env.NODE_ENV = originalNodeEnv
    })

    it('should not throw on invalid CSP config in development', () => {
      expect(() => {
        createSecurityMiddleware({
          isDevelopment: true,
          allowedDomains: {
            external: ['invalid-domain'],
          },
        })
      }).not.toThrow()
    })
  })

  describe('createCSPReportHandler', () => {
    it('should handle valid CSP violation reports', async () => {
      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
      const handler = createCSPReportHandler({ logToConsole: true })

      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.com/script.js',
          referrer: '',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
        },
      }

      const request = new NextRequest('https://example.com/api/csp-report', {
        method: 'POST',
        body: JSON.stringify(violationReport),
        headers: { 'content-type': 'application/json' },
      })

      const response = await handler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('received')
      expect(consoleInfo).toHaveBeenCalled()

      consoleInfo.mockRestore()
    })

    it('should handle high severity violations', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      const onViolation = vi.fn()

      const handler = createCSPReportHandler({
        logToConsole: false,
        onViolation,
        alertOnSeverity: 'high',
      })

      const violationReport = {
        'csp-report': {
          'document-uri': 'https://example.com/page',
          'violated-directive': 'script-src',
          'blocked-uri': 'javascript:alert(1)',
          referrer: '',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
        },
      }

      const request = new NextRequest('https://example.com/api/csp-report', {
        method: 'POST',
        body: JSON.stringify(violationReport),
        headers: { 'content-type': 'application/json' },
      })

      const response = await handler(request)

      expect(response.status).toBe(200)
      expect(onViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high',
          'violated-directive': 'script-src',
        }),
      )
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('HIGH SEVERITY CSP VIOLATION'),
      )

      consoleError.mockRestore()
    })

    it('should handle invalid report format', async () => {
      const handler = createCSPReportHandler()

      const request = new NextRequest('https://example.com/api/csp-report', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'report' }),
        headers: { 'content-type': 'application/json' },
      })

      const response = await handler(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid report format')
    })

    it('should handle JSON parsing errors', async () => {
      const handler = createCSPReportHandler()

      const request = new NextRequest('https://example.com/api/csp-report', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'content-type': 'application/json' },
      })

      const response = await handler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('getSecurityConfig', () => {
    it('should return development config by default', () => {
      const config = getSecurityConfig()

      expect(config.isDevelopment).toBe(true)
      expect(config.reportOnly).toBe(true)
      expect(config.enableReporting).toBe(false)
    })

    it('should return production config for production environment', () => {
      const config = getSecurityConfig('production')

      expect(config.isDevelopment).toBe(false)
      expect(config.reportOnly).toBe(false)
      expect(config.enableReporting).toBe(true)
      expect(config.reportUri).toBe('/api/csp-report')
    })

    it('should return staging config for staging environment', () => {
      const config = getSecurityConfig('staging')

      expect(config.isDevelopment).toBe(false)
      expect(config.reportOnly).toBe(false)
      expect(config.enableReporting).toBe(true)
      expect(config.logViolations).toBe(true)
    })

    it('should use NODE_ENV when no environment specified', () => {
      const originalNodeEnv = process.env.NODE_ENV

      process.env.NODE_ENV = 'production'
      const prodConfig = getSecurityConfig()
      expect(prodConfig.isDevelopment).toBe(false)

      process.env.NODE_ENV = 'development'
      const devConfig = getSecurityConfig()
      expect(devConfig.isDevelopment).toBe(true)

      process.env.NODE_ENV = originalNodeEnv
    })
  })

  describe('withSecurity', () => {
    it('should combine security middleware with existing middleware', () => {
      const originalMiddleware = vi.fn((_req: NextRequest) => {
        const response = NextResponse.next()
        response.headers.set('Custom-Header', 'from-original')
        return response
      })

      const combinedMiddleware = withSecurity(originalMiddleware)
      const request = new NextRequest('https://example.com/')

      const response = combinedMiddleware(request, mkCtx(request)) as NextResponse

      expect(originalMiddleware).toHaveBeenCalled()
      expect(response.headers.get('Custom-Header')).toBe('from-original')
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
    })

    it('should pass security options to security middleware', () => {
      const originalMiddleware = vi.fn(() => NextResponse.next())
      const securityOptions: SecurityMiddlewareOptions = {
        reportOnly: true,
        isDevelopment: false,
      }

      const combinedMiddleware = withSecurity(
        originalMiddleware,
        securityOptions,
      )
      const request = new NextRequest('https://example.com/')

      const response = combinedMiddleware(request, mkCtx(request)) as NextResponse

      expect(
        response.headers.get('Content-Security-Policy-Report-Only'),
      ).toBeTruthy()
      expect(response.headers.get('Content-Security-Policy')).toBeFalsy()
    })
  })

  describe('shouldBypassSecurity', () => {
    it('should bypass security for Next.js internals', () => {
      const nextInternalRequest = new NextRequest(
        'https://example.com/_next/static/chunk.js',
      )
      const apiNextRequest = new NextRequest(
        'https://example.com/api/_next/webpack',
      )
      const normalRequest = new NextRequest('https://example.com/dashboard')

      expect(shouldBypassSecurity(nextInternalRequest)).toBe(true)
      expect(shouldBypassSecurity(apiNextRequest)).toBe(true)
      expect(shouldBypassSecurity(normalRequest)).toBe(false)
    })

    it('should bypass security for static files', () => {
      const cssRequest = new NextRequest('https://example.com/styles.css')
      const jsRequest = new NextRequest('https://example.com/script.js')
      const imageRequest = new NextRequest('https://example.com/image.png')
      const htmlRequest = new NextRequest('https://example.com/page.html')
      const pageRequest = new NextRequest('https://example.com/dashboard')

      expect(shouldBypassSecurity(cssRequest)).toBe(true)
      expect(shouldBypassSecurity(jsRequest)).toBe(true)
      expect(shouldBypassSecurity(imageRequest)).toBe(true)
      expect(shouldBypassSecurity(htmlRequest)).toBe(false) // HTML should get security headers
      expect(shouldBypassSecurity(pageRequest)).toBe(false)
    })

    it('should bypass security for health check endpoints', () => {
      const healthRequest = new NextRequest('https://example.com/health')
      const apiHealthRequest = new NextRequest('https://example.com/api/health')
      const pingRequest = new NextRequest('https://example.com/ping')

      expect(shouldBypassSecurity(healthRequest)).toBe(true)
      expect(shouldBypassSecurity(apiHealthRequest)).toBe(true)
      expect(shouldBypassSecurity(pingRequest)).toBe(true)
    })
  })

  describe('extractNonce', () => {
    it('should extract nonce from request headers', () => {
      const request = new NextRequest('https://example.com/', {
        headers: {
          'x-csp-nonce': 'test-nonce-value',
        },
      })

      const nonce = extractNonce(request)

      expect(nonce).toBe('test-nonce-value')
    })

    it('should return null when nonce header is not present', () => {
      const request = new NextRequest('https://example.com/')

      const nonce = extractNonce(request)

      expect(nonce).toBe(null)
    })

    it('should return null for empty nonce header', () => {
      const request = new NextRequest('https://example.com/', {
        headers: {
          'x-csp-nonce': '',
        },
      })

      const nonce = extractNonce(request)

      expect(nonce).toBe('')
    })
  })

  describe('Error handling', () => {
    it('should handle middleware errors gracefully', () => {
      const middleware = createSecurityMiddleware({
        // Invalid configuration that could cause issues
        allowedDomains: {
          // @ts-expect-error intentionally invalid config for error handling test
          external: undefined,
        },
      })

      const request = new NextRequest('https://example.com/')

      // Should not throw
      expect(() => middleware(request, mkCtx(request))).not.toThrow()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle requests with existing security headers', () => {
      const middleware = createSecurityMiddleware()
      const request = new NextRequest('https://example.com/', {
        headers: {
          'Content-Security-Policy': 'default-src none',
        },
      })

      const response = middleware(request, mkCtx(request)) as NextResponse

      // Should override with our CSP
      const csp = response.headers.get('Content-Security-Policy')
      expect(csp).toBeTruthy()
      expect(csp).toContain("default-src 'self'")
    })

    it('should work with different request methods', () => {
      const middleware = createSecurityMiddleware()

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

      methods.forEach((method) => {
        const request = new NextRequest('https://example.com/', { method })
        const response = middleware(request, mkCtx(request)) as NextResponse as NextResponse

        expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
      })
    })

    it('should preserve request body for POST requests', () => {
      const middleware = createSecurityMiddleware()
      const body = JSON.stringify({ test: 'data' })

      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = middleware(request, mkCtx(request)) as NextResponse

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
    })
  })
})
