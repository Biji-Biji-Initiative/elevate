import { NextRequest, NextResponse } from 'next/server';

interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (use Redis in production)
const store = new Map<string, RequestRecord>();

// Cleanup old records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetTime <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class RateLimiter {
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  private getKey(request: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }
    
    // Default: use IP address and user agent
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `${ip}:${userAgent}`;
  }

  private getClientIP(request: NextRequest): string {
    // Check various headers for the real IP
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const xRealIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(',')[0].trim();
    }
    
    if (xRealIp) return xRealIp;
    if (cfConnectingIp) return cfConnectingIp;
    
    return 'unknown-ip';
  }

  public async checkLimit(request: NextRequest): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
  }> {
    const key = this.getKey(request);
    const now = Date.now();
    const windowStart = now;
    const windowEnd = now + this.config.windowMs;

    let record = store.get(key);
    
    if (!record || record.resetTime <= now) {
      // Create new record or reset expired one
      record = {
        count: 0,
        resetTime: windowEnd
      };
    }

    // Increment request count
    record.count++;
    store.set(key, record);

    const allowed = record.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - record.count);

    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
      totalRequests: record.count
    };
  }

  public createMiddleware() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const result = await this.checkLimit(request);
      
      if (!result.allowed) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': this.config.maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
            }
          }
        );
      }

      // Add rate limit headers to successful responses
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
      
      return null; // Continue to next handler
    };
  }
}

// Pre-configured rate limiters
export const webhookRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.WEBHOOK_RATE_LIMIT_RPM || '120'),
  keyGenerator: (request) => {
    // For webhooks, rate limit by IP + User-Agent + specific headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown-ip';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const signature = request.headers.get('svix-signature') || 
                     request.headers.get('x-kajabi-signature') || '';
    
    return `webhook:${ip}:${userAgent}:${signature.slice(0, 16)}`;
  }
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.RATE_LIMIT_RPM || '60'),
});

// Helper function to apply rate limiting
export async function withRateLimit(
  request: NextRequest,
  rateLimiter: RateLimiter,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const limitResult = await rateLimiter.checkLimit(request);
  
  if (!limitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((limitResult.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimiter['config'].maxRequests.toString(),
          'X-RateLimit-Remaining': limitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(limitResult.resetTime / 1000).toString(),
          'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
        }
      }
    );
  }

  const response = await handler();
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', rateLimiter['config'].maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(limitResult.resetTime / 1000).toString());
  
  return response;
}