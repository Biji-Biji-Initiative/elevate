import crypto from 'crypto'

import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'


export const CSRF_TOKEN_HEADER = 'X-CSRF-Token'
export const CSRF_COOKIE_NAME = '_csrf'
export const CSRF_SECRET_HEADER = 'X-CSRF-Secret'

interface CsrfConfig {
  cookieName?: string
  headerName?: string
  tokenLength?: number
  maxAge?: number // in seconds
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  ignoreMethods?: string[]
}

export class CSRFError extends Error {
  public readonly name = 'CSRFError'
  public readonly status = 403

  constructor(message = 'Invalid or missing CSRF token') {
    super(message)
  }
}

export class CSRFManager {
  private config: Required<CsrfConfig>

  constructor(config?: CsrfConfig) {
    this.config = {
      cookieName: config?.cookieName || CSRF_COOKIE_NAME,
      headerName: config?.headerName || CSRF_TOKEN_HEADER,
      tokenLength: config?.tokenLength || 32,
      maxAge: config?.maxAge || 3600, // 1 hour
      secure: config?.secure ?? process.env.NODE_ENV === 'production',
      sameSite: config?.sameSite || 'lax',
      ignoreMethods: config?.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
    }
  }

  /**
   * Generates a cryptographically secure random token
   */
  generateToken(): string {
    return crypto.randomBytes(this.config.tokenLength).toString('hex')
  }

  /**
   * Creates a double-submit token pair (secret + token)
   * The secret is stored in httpOnly cookie, token is returned for forms
   */
  generateTokenPair(): { secret: string; token: string } {
    const secret = this.generateToken()
    const token = this.generateToken()
    return { secret, token }
  }

  /**
   * Creates a token that includes both secret and token for single-value usage
   */
  generateSingleToken(): string {
    const { secret, token } = this.generateTokenPair()
    return `${secret}.${token}`
  }

  /**
   * Validates a token pair using double-submit cookie pattern
   */
  validateTokenPair(secret: string, token: string): boolean {
    if (!secret || !token) return false

    try {
      // Use timing-safe comparison to prevent timing attacks
      const secretBuffer = Buffer.from(secret, 'hex')
      const tokenBuffer = Buffer.from(token, 'hex')

      return (
        crypto.timingSafeEqual(secretBuffer, tokenBuffer) &&
        token.length === this.config.tokenLength * 2
      )
    } catch {
      return false
    }
  }

  /**
   * Validates a single token (includes both secret and token)
   */
  validateSingleToken(singleToken: string): boolean {
    if (!singleToken || typeof singleToken !== 'string') return false

    const parts = singleToken.split('.')
    if (parts.length !== 2) return false

    const [secret, token] = parts
    if (!secret || !token) return false
    return this.validateTokenPair(secret, token)
  }

  /**
   * Sets CSRF cookie in response
   */
  setCsrfCookie(response: NextResponse, secret: string): void {
    const cookieValue = `${secret}; Max-Age=${this.config.maxAge}; Path=/; ${
      this.config.secure ? 'Secure; ' : ''
    }SameSite=${this.config.sameSite}; HttpOnly`

    response.headers.set(
      'Set-Cookie',
      `${this.config.cookieName}=${cookieValue}`,
    )
  }

  /**
   * Gets CSRF cookie from request
   */
  getCsrfCookie(request: NextRequest): string | null {
    return request.cookies.get(this.config.cookieName)?.value || null
  }

  /**
   * Gets CSRF token from request headers or form data
   */
  async getCsrfToken(request: NextRequest): Promise<string | null> {
    // Check headers first
    const headerToken = request.headers.get(this.config.headerName)
    if (headerToken) return headerToken

    // For form submissions, check form data
    if (
      request.headers
        .get('content-type')
        ?.includes('application/x-www-form-urlencoded')
    ) {
      try {
        const formData = await request.formData()
        return formData.get('_csrf')?.toString() || null
      } catch {
        // If formData fails, continue
      }
    }

    return null
  }

  /**
   * Validates CSRF token against cookie
   */
  async validateRequest(request: NextRequest): Promise<boolean> {
    const method = request.method.toUpperCase()

    // Skip validation for safe methods
    if (this.config.ignoreMethods.includes(method)) {
      return true
    }

    const secret = this.getCsrfCookie(request)
    const token = await this.getCsrfToken(request)

    if (!secret || !token) {
      return false
    }

    // For single token format
    if (token.includes('.')) {
      return this.validateSingleToken(token)
    }

    // For double-submit cookie pattern
    return this.validateTokenPair(secret, token)
  }

  /**
   * Middleware function for automatic CSRF protection
   */
  middleware() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const method = request.method.toUpperCase()

      // Skip validation for safe methods
      if (this.config.ignoreMethods.includes(method)) {
        return null // Continue to next handler
      }

      // Validate CSRF token
      const isValid = await this.validateRequest(request)

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'CSRF token validation failed',
            code: 'CSRF_INVALID',
          },
          { status: 403 },
        )
      }

      return null // Continue to next handler
    }
  }

  /**
   * Generates a new CSRF token for forms
   * Can be called from API routes or Server Components
   */
  generateTokenForResponse(): {
    token: string
    response: NextResponse
  } {
    const { secret, token } = this.generateTokenPair()

    const response = NextResponse.json({ token })
    this.setCsrfCookie(response, secret)

    return { token, response }
  }
}

// Default CSRF manager instance
export const csrfManager = new CSRFManager()

/**
 * Server-side function to generate CSRF token for forms
 * Use this in Server Components or API routes
 */
export async function generateCSRFToken(): Promise<string> {
  const { secret, token } = csrfManager.generateTokenPair()

  // Set cookie using Next.js cookies() function
  const cookieStore = await cookies()
  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: secret,
    maxAge: 3600, // 1 hour
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  })

  return token
}

/**
 * Higher-order function to protect API routes with CSRF validation
 */
export function withCSRFProtection<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const method = request.method.toUpperCase()

    // Skip validation for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return handler(request, ...args)
    }

    // Validate CSRF token
    const isValid = await csrfManager.validateRequest(request)

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSRF token validation failed',
          code: 'CSRF_INVALID',
        },
        { status: 403 },
      )
    }

    return handler(request, ...args)
  }
}

/**
 * Utility function to check if request needs CSRF protection
 */
export function requiresCSRFProtection(request: NextRequest): boolean {
  const method = request.method.toUpperCase()
  return !['GET', 'HEAD', 'OPTIONS'].includes(method)
}

/**
 * Extract CSRF token from various sources in request
 */
export async function extractCSRFToken(
  request: NextRequest,
): Promise<string | null> {
  return csrfManager.getCsrfToken(request)
}

/**
 * Validate CSRF token manually
 */
export async function validateCSRFToken(
  request: NextRequest,
): Promise<boolean> {
  return csrfManager.validateRequest(request)
}
