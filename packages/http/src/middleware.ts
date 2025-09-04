import { NextResponse, type NextRequest } from 'next/server'

import { z } from 'zod'

import { 
  createErrorResponse, 
  generateTraceId, 
  logError,
  ElevateApiError,
  ValidationError,
  TRACE_HEADER,
  redactSensitiveData
} from './error-utils'

// Context for API handlers
export interface ApiContext {
  traceId: string
  startTime: number
  request: NextRequest
  validatedBody?: unknown
  validatedQuery?: unknown
}

// API handler type with context
export type ApiHandler<_T = unknown> = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse>

// Simple handler type (Next.js style)
export type SimpleHandler = (request: NextRequest) => Promise<NextResponse>

// Global error boundary for API routes
export function withApiErrorHandling(handler: ApiHandler): SimpleHandler {
  return async (request: NextRequest) => {
    const traceId = generateTraceId()
    const startTime = Date.now()
    const context: ApiContext = { traceId, startTime, request }

    try {
      // Add trace ID to response headers
      const response = await handler(request, context)
      response.headers.set(TRACE_HEADER, traceId)
      
      // Add performance timing (if response time > 1s, log it)
      const duration = Date.now() - startTime
      if (duration > 1000) {
        console.warn(`[SLOW API] ${request.method} ${request.url} took ${duration}ms`, {
          traceId,
          method: request.method,
          url: request.url,
          duration
        })
      }
      
      return response
    } catch (error) {
      // Log the error with context
      const errorObj = error instanceof Error ? error : new Error(String(error))
      logError(errorObj, traceId, {
        method: request.method,
        url: request.url,
        duration: Date.now() - startTime,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        ip: request.headers.get('x-forwarded-for') || 
            request.headers.get('x-real-ip') ||
            'unknown'
      })

      const response = createErrorResponse(error, 500, traceId)
      response.headers.set(TRACE_HEADER, traceId)
      return response
    }
  }
}

// Authentication middleware that can be composed with other middleware
export function requireAuth() {
  return async (_request: NextRequest, _context: ApiContext, next: () => Promise<NextResponse>) => {
    // This is a placeholder - actual auth checking would happen here
    // For now, we'll assume auth is handled by Clerk in the handlers themselves
    return next()
  }
}

// Rate limiting middleware 
export function rateLimit(maxRequests: number, windowMs: number) {
  // Simple in-memory rate limiter - in production you'd use Redis
  const requests = new Map<string, { count: number; resetTime: number }>()
  const MAX_KEYS = 10_000
  
  return async (request: NextRequest, context: ApiContext, next: () => Promise<NextResponse>) => {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const key = `rate_limit:${ip}`
    const now = Date.now()
    
    // Sweep expired entries to prevent unbounded growth
    for (const [k, v] of requests) {
      if (now > v.resetTime) {
        requests.delete(k)
      }
    }

    const current = requests.get(key)
    if (!current || now > current.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs })
      if (requests.size > MAX_KEYS) {
        const oldestKey = requests.keys().next().value
        if (oldestKey) requests.delete(oldestKey)
      }
      return next()
    }
    
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetTime - now) / 1000)
      throw new ElevateApiError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        'RATE_LIMIT_EXCEEDED',
        { limit: maxRequests, windowMs, retryAfter },
        context.traceId
      )
    }
    
    current.count++
    return next()
  }
}

// Request validation middleware
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest, context: ApiContext, next: () => Promise<NextResponse>) => {
    try {
      const raw: unknown = await request.json()
      const validatedData = schema.parse(raw)
      // Attach validated data to the context for use in handlers
      context.validatedBody = validatedData
      return next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error, 'Request validation failed', context.traceId)
      }
      if (error instanceof SyntaxError) {
        throw new ElevateApiError('Invalid JSON', 'VALIDATION_ERROR', undefined, context.traceId)
      }
      throw error
    }
  }
}

// Query parameter validation middleware
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest, context: ApiContext, next: () => Promise<NextResponse>) => {
    try {
      const { searchParams } = new URL(request.url)
      const queryData: Record<string, string | string[]> = {}
      for (const key of new Set(searchParams.keys())) {
        const all = searchParams.getAll(key)
        queryData[key] = all.length > 1 ? all : (all[0] ?? '')
      }
      const validatedQuery = schema.parse(queryData)
      // Attach validated query to the context
      context.validatedQuery = validatedQuery
      return next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error, 'Query validation failed', context.traceId)
      }
      throw error
    }
  }
}

// Compose multiple middleware functions
export function compose(...middleware: Array<(req: NextRequest, ctx: ApiContext, next: () => Promise<NextResponse>) => Promise<NextResponse>>) {
  return (handler: ApiHandler): SimpleHandler => {
    return withApiErrorHandling(async (request: NextRequest, context: ApiContext) => {
      let index = 0
      
      const next = async (): Promise<NextResponse> => {
        if (index < middleware.length) {
          const current = middleware[index]
          index += 1
          if (current) {
            return current(request, context, next)
          }
        }
        return handler(request, context)
      }
      
      return next()
    })
  }
}

// Get environment-specific allowed origins
function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  
  if (isProd) {
    // Production: only allow the configured site URL
    return siteUrl ? [siteUrl] : ['https://leaps.mereka.org']
  } else {
    // Development: allow localhost with various ports
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ]
    // Also include site URL if configured
    return siteUrl ? [...devOrigins, siteUrl] : devOrigins
  }
}

// CORS middleware for API routes with security best practices
export function cors(options: {
  origin?: string | string[]
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  exposeHeaders?: string[]
} = {}) {
  const {
    origin = getAllowedOrigins(),
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials = false,
    exposeHeaders = [TRACE_HEADER]
  } = options

  // CRITICAL SECURITY CHECK: Never allow wildcard origin with credentials
  if (credentials && (origin === '*' || (Array.isArray(origin) && origin.includes('*')))) {
    throw new Error(
      'CORS Security Error: Cannot use wildcard origin (*) with credentials=true. ' +
      'This creates a critical security vulnerability that allows any site to make ' +
      'credentialed requests. Please specify explicit allowed origins.'
    )
  }

  // Normalize origin to array for consistent handling
  const allowedOrigins = Array.isArray(origin) ? origin : [origin]

  return async (request: NextRequest, _context: ApiContext, next: () => Promise<NextResponse>) => {
    const requestOrigin = request.headers.get('origin')
    
    // Determine if origin is allowed
    let allowedOrigin: string | null = null
    
    if (allowedOrigins.includes('*') && !credentials) {
      // Only allow wildcard if credentials are disabled
      allowedOrigin = '*'
    } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      // Origin is in allowed list
      allowedOrigin = requestOrigin
    }
    
    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })
      
      // Set CORS headers only if origin is allowed
      if (allowedOrigin) {
        const reqMethod = request.headers.get('access-control-request-method')
        const reqHeaders = request.headers.get('access-control-request-headers')
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
        response.headers.set('Access-Control-Allow-Methods', (reqMethod ? [reqMethod] : methods).join(', '))
        response.headers.set('Access-Control-Allow-Headers', (reqHeaders ? reqHeaders.split(/\s*,\s*/).filter(Boolean) : headers).join(', '))
        response.headers.set('Access-Control-Max-Age', '600')
        response.headers.set('Access-Control-Expose-Headers', exposeHeaders.join(', '))
        
        if (credentials) {
          response.headers.set('Access-Control-Allow-Credentials', 'true')
        }
      }
      
      // Always add Vary header for cache correctness
      response.headers.set('Vary', 'Origin')
      
      return response
    }
    
    // For actual requests, add CORS headers to the response
    const response = await next()
    
    // Set CORS headers only if origin is allowed
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
      response.headers.set('Access-Control-Expose-Headers', exposeHeaders.join(', '))
      
      if (credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true')
      }
    }
    
    // Always add Vary header for cache correctness
    response.headers.set('Vary', 'Origin')
    
    return response
  }
}

// Comprehensive security headers middleware
export function securityHeaders() {
  return async (request: NextRequest, _context: ApiContext, next: () => Promise<NextResponse>) => {
    const response = await next()
    const isProduction = process.env.NODE_ENV === 'production'
    
    // Core security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-DNS-Prefetch-Control', 'on')
    
    // Enhanced Permissions Policy - restrict powerful browser features
    const permissionsPolicy = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'payment=()',
      'sync-xhr=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'bluetooth=()',
      'midi=()',
      'notifications=()',
      'push=()',
      'speaker-selection=()',
      'ambient-light-sensor=()',
      'battery=()',
      'display-capture=()',
      'document-domain=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'gamepad=()',
      'hid=()',
      'idle-detection=()',
      'local-fonts=()',
      'serial=()',
      'storage-access=()',
      'window-management=()',
      'xr-spatial-tracking=()'
    ].join(', ')
    response.headers.set('Permissions-Policy', permissionsPolicy)
    
    // HSTS for production - force HTTPS and include subdomains
    if (isProduction) {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    } else {
      // Ensure not present in non-production environments
      response.headers.delete('Strict-Transport-Security')
    }
    
    // Additional modern security headers
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'"
    ].join('; ')
    response.headers.set('Content-Security-Policy', csp)
    
    // Remove server info and fingerprinting headers
    response.headers.delete('Server')
    response.headers.delete('X-Powered-By')
    response.headers.delete('Via')
    response.headers.delete('X-AspNet-Version')
    response.headers.delete('X-AspNetMvc-Version')
    
    // Add security-focused cache control for API responses
    if (request.url.includes('/api/')) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }
    
    return response
  }
}

// Request logging middleware
export function requestLogger() {
  return async (request: NextRequest, context: ApiContext, next: () => Promise<NextResponse>) => {
    const start = Date.now()
    
    const ua = request.headers.get('user-agent') || ''
    const rawIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    console.log(`[API] ${request.method} ${request.url} - Start`, {
      traceId: context.traceId,
      method: request.method,
      url: redactSensitiveData(request.url),
      userAgent: redactSensitiveData(ua),
      ip: redactSensitiveData(rawIp)
    })
    
    const response = await next()
    const duration = Date.now() - start
    
    console.log(`[API] ${request.method} ${request.url} - ${response.status}`, {
      traceId: context.traceId,
      method: request.method,
      url: redactSensitiveData(request.url),
      status: response.status,
      duration
    })
    
    return response
  }
}
