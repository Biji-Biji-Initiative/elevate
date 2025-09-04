import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CSRFManager, CSRFError, csrfManager, withCSRFProtection } from '../csrf'

// Mock crypto for consistent testing
vi.mock('crypto', async () => {
  const actual = (await vi.importActual('crypto')) as typeof import('crypto')
  return {
    default: {
      ...actual.default,
      randomBytes: vi.fn((size: number) => Buffer.from('a'.repeat(size))),
      timingSafeEqual: (a: Buffer, b: Buffer) => a.equals(b)
    }
  }
})

describe('CSRFManager', () => {
  let manager: CSRFManager

  beforeEach(() => {
    manager = new CSRFManager({
      tokenLength: 16, // Smaller for testing
      maxAge: 3600,
      secure: false,
      sameSite: 'lax'
    })
  })

  describe('generateToken', () => {
    it('should generate a token of correct length', () => {
      const token = manager.generateToken()
      expect(token).toBe('a'.repeat(32)) // 16 bytes = 32 hex chars
    })
  })

  describe('generateTokenPair', () => {
    it('should generate a secret and token pair', () => {
      const { secret, token } = manager.generateTokenPair()
      expect(secret).toBe('a'.repeat(32))
      expect(token).toBe('a'.repeat(32))
      expect(secret).not.toBe(token) // Should be different calls
    })
  })

  describe('validateTokenPair', () => {
    it('should validate matching token pairs', () => {
      const secret = 'a'.repeat(32)
      const token = 'b'.repeat(32)
      
      const isValid = manager.validateTokenPair(secret, token)
      expect(isValid).toBe(true)
    })

    it('should reject empty tokens', () => {
      expect(manager.validateTokenPair('', 'token')).toBe(false)
      expect(manager.validateTokenPair('secret', '')).toBe(false)
      expect(manager.validateTokenPair('', '')).toBe(false)
    })

    it('should reject short tokens', () => {
      expect(manager.validateTokenPair('short', 'token')).toBe(false)
    })
  })

  describe('validateSingleToken', () => {
    it('should validate properly formatted single tokens', () => {
      const singleToken = 'a'.repeat(32) + '.' + 'b'.repeat(32)
      expect(manager.validateSingleToken(singleToken)).toBe(true)
    })

    it('should reject malformed single tokens', () => {
      expect(manager.validateSingleToken('no-dot')).toBe(false)
      expect(manager.validateSingleToken('too.many.dots')).toBe(false)
      expect(manager.validateSingleToken('')).toBe(false)
      expect(manager.validateSingleToken('short.token')).toBe(false)
    })
  })

  describe('getCsrfCookie', () => {
    it('should extract CSRF cookie from request', () => {
      const request = new NextRequest('https://example.com/api/test', {
        headers: {
          'Cookie': '_csrf=test-secret'
        }
      })
      
      expect(manager.getCsrfCookie(request)).toBe('test-secret')
    })

    it('should return null if no CSRF cookie', () => {
      const request = new NextRequest('https://example.com/api/test')
      expect(manager.getCsrfCookie(request)).toBe(null)
    })
  })

  describe('getCsrfToken', () => {
    it('should extract token from X-CSRF-Token header', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'test-token'
        }
      })
      
      const token = await manager.getCsrfToken(request)
      expect(token).toBe('test-token')
    })

    it('should extract token from form data', async () => {
      const formData = new FormData()
      formData.append('_csrf', 'form-token')
      formData.append('other', 'data')
      
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      
      const token = await manager.getCsrfToken(request)
      expect(token).toBe('form-token')
    })

    it('should return null if no token found', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST'
      })
      
      const token = await manager.getCsrfToken(request)
      expect(token).toBe(null)
    })
  })

  describe('validateRequest', () => {
    it('should allow GET requests without validation', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(true)
    })

    it('should allow HEAD requests without validation', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'HEAD'
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(true)
    })

    it('should allow OPTIONS requests without validation', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'OPTIONS'
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(true)
    })

    it('should validate POST requests with correct token', async () => {
      const secret = 'a'.repeat(32)
      const token = 'b'.repeat(32)
      
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Cookie': `_csrf=${secret}`,
          'X-CSRF-Token': token
        }
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(true)
    })

    it('should reject POST requests with missing token', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Cookie': '_csrf=secret'
        }
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(false)
    })

    it('should reject POST requests with missing secret', async () => {
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': 'token'
        }
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(false)
    })

    it('should validate single token format', async () => {
      const singleToken = 'a'.repeat(32) + '.' + 'b'.repeat(32)
      
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': singleToken
        }
      })
      
      const isValid = await manager.validateRequest(request)
      expect(isValid).toBe(true)
    })
  })

  describe('middleware', () => {
    it('should allow safe methods through', async () => {
      const middleware = manager.middleware()
      const request = new NextRequest('https://example.com/api/test', {
        method: 'GET'
      })
      
      const result = await middleware(request)
      expect(result).toBe(null) // Continue to next handler
    })

    it('should block unsafe methods with invalid tokens', async () => {
      const middleware = manager.middleware()
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST'
      })
      
      const result = await middleware(request)
      expect(result).not.toBe(null)
      expect(result?.status).toBe(403)
    })

    it('should allow unsafe methods with valid tokens', async () => {
      const middleware = manager.middleware()
      const secret = 'a'.repeat(32)
      const token = 'b'.repeat(32)
      
      const request = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Cookie': `_csrf=${secret}`,
          'X-CSRF-Token': token
        }
      })
      
      const result = await middleware(request)
      expect(result).toBe(null) // Continue to next handler
    })
  })
})

describe('withCSRFProtection HOF', () => {
  const mockHandler = vi.fn()

  beforeEach(() => {
    mockHandler.mockClear()
  })

  it('should allow safe methods without validation', async () => {
    const protectedHandler = withCSRFProtection(mockHandler)
    const request = new NextRequest('https://example.com/api/test', {
      method: 'GET'
    })
    
    await protectedHandler(request)
    expect(mockHandler).toHaveBeenCalledWith(request)
  })

  it('should block unsafe methods with invalid tokens', async () => {
    const protectedHandler = withCSRFProtection(mockHandler)
    const request = new NextRequest('https://example.com/api/test', {
      method: 'POST'
    })
    
    const result = await protectedHandler(request)
    expect(mockHandler).not.toHaveBeenCalled()
    expect(result.status).toBe(403)
    
    const body = await result.json()
    expect(body.code).toBe('CSRF_INVALID')
  })
})

describe('CSRFError', () => {
  it('should create error with correct properties', () => {
    const error = new CSRFError('Test message')
    
    expect(error.name).toBe('CSRFError')
    expect(error.message).toBe('Test message')
    expect(error.status).toBe(403)
  })

  it('should use default message', () => {
    const error = new CSRFError()
    
    expect(error.message).toBe('Invalid or missing CSRF token')
  })
})
