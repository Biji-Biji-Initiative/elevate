import { NextRequest, NextResponse } from 'next/server';

// Optional Redis client (Upstash) for multi-instance rate limiting
type RedisLike = {
  incr: (key: string) => Promise<number>
  pexpire: (key: string, ttlMs: number) => Promise<unknown>
  pttl: (key: string) => Promise<number>
};

let redis: RedisLike | null = null;
async function getRedis(): Promise<RedisLike | null> {
  if (redis !== null) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return null;
  }
  try {
    // Dynamically import to keep it optional
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mod = await import('@upstash/redis');
    const client = new mod.Redis({ url, token });
    redis = client as unknown as RedisLike;
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

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

// In-memory store for rate limiting (fallback when Redis not configured)
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
      const firstIp = xForwardedFor.split(',')[0];
      return firstIp ? firstIp.trim() : 'unknown-ip';
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
    const windowEnd = now + this.config.windowMs;

    const client = await getRedis();
    if (client) {
      // Multi-instance safe using Redis INCR + PEXPIRE
      const redisKey = `rl:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.pexpire(redisKey, this.config.windowMs);
      }
      const ttl = await client.pttl(redisKey);
      const reset = ttl > 0 ? now + ttl : windowEnd;
      const allowed = count <= this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count);
      return { allowed, remaining, resetTime: reset, totalRequests: count };
    }

    // Fallback: in-memory (single instance only)
    let record = store.get(key);
    if (!record || record.resetTime <= now) {
      record = { count: 0, resetTime: windowEnd };
    }
    record.count++;
    store.set(key, record);
    const allowed = record.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - record.count);
    return { allowed, remaining, resetTime: record.resetTime, totalRequests: record.count };
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
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const firstIp = xForwardedFor?.split(',')[0];
    const ip = firstIp?.trim() || 
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

export const adminRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.ADMIN_RATE_LIMIT_RPM || '40'),
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
