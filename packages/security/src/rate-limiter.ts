import { NextResponse, type NextRequest } from 'next/server';

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
    const mod = await import('@upstash/redis');
    const client = new mod.Redis({ url, token });
    const maybeRedis: unknown = client;
    const isRedisLike = (v: unknown): v is RedisLike =>
      !!v && typeof v === 'object' &&
      'incr' in (v as Record<string, unknown>) &&
      'pexpire' in (v as Record<string, unknown>) &&
      'pttl' in (v as Record<string, unknown>);
    redis = isRedisLike(maybeRedis) ? maybeRedis : null;
    return redis;
  } catch {
    redis = null;
    return null;
  }
}

interface RateLimiterConfig {
  name?: string; // Identifier for metrics
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

type RateLimitCounter = { allowed: number; blocked: number; lastReset: number };
const rateLimitStats = new Map<string, RateLimitCounter>();

// Cleanup manager for proper lifecycle management
class CleanupManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;
  private lastCleanup = Date.now();
  
  constructor() {
    this.startCleanup();
  }
  
  private startCleanup(): void {
    if (this.cleanupInterval || this.isDestroyed) return;
    
    // In serverless environments, cleanup more frequently since processes are short-lived
    // In traditional server environments, use standard 5-minute intervals
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_RUNTIME;
    const cleanupIntervalMs = isServerless ? 30 * 1000 : 5 * 60 * 1000; // 30s for serverless, 5min for servers
    
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, cleanupIntervalMs);
    
    // Ensure cleanup runs on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => this.destroy());
      process.on('SIGTERM', () => this.destroy());
      process.on('SIGINT', () => this.destroy());
    }
  }
  
  private performCleanup(): void {
    if (this.isDestroyed) return;
    
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean expired entries from the main store
    const keysToDelete: string[] = [];
    store.forEach((record, key) => {
      if (record.resetTime <= now) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      store.delete(key);
      cleanedCount++;
    });
    
    // Clean old stats (reset counters older than 1 hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    const statsToDelete: string[] = [];
    rateLimitStats.forEach((counter, name) => {
      if (counter.lastReset < oneHourAgo) {
        statsToDelete.push(name);
      }
    });
    statsToDelete.forEach(name => {
      rateLimitStats.delete(name);
    });
    
    this.lastCleanup = now;
    
    // In development, log cleanup activity
    if (process.env.NODE_ENV === 'development' && cleanedCount > 0) {
      console.log(`[RateLimit] Cleaned ${cleanedCount} expired entries, store size: ${store.size}`);
    }
  }
  
  public forceCleanup(): void {
    this.performCleanup();
  }
  
  public destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Final cleanup
    this.performCleanup();
  }
  
  public getStats() {
    return {
      storeSize: store.size,
      statsSize: rateLimitStats.size,
      lastCleanup: this.lastCleanup,
      isDestroyed: this.isDestroyed
    };
  }
}

// Global cleanup manager instance
const cleanupManager = new CleanupManager();

// Export cleanup utilities for testing and manual management
export const cleanupUtils = {
  forceCleanup: () => cleanupManager.forceCleanup(),
  destroy: () => cleanupManager.destroy(),
  getStats: () => cleanupManager.getStats(),
};

function getCounter(name: string): RateLimitCounter {
  const now = Date.now();
  let c = rateLimitStats.get(name);
  if (!c) {
    c = { allowed: 0, blocked: 0, lastReset: now };
    rateLimitStats.set(name, c);
  }
  // Update lastReset to current time to keep it active
  c.lastReset = now;
  return c;
}

export function getRateLimitStats(): Record<string, RateLimitCounter> {
  return Object.fromEntries(rateLimitStats.entries());
}

export function resetRateLimitStats(): void {
  rateLimitStats.clear();
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private name: string;
  private lastUsed: number;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.name = config.name || 'unnamed';
    this.lastUsed = Date.now();
    
    // Note: In serverless environments (Vercel, AWS Lambda), the in-memory store
    // is largely ineffective due to cold starts and instance isolation.
    // The store is primarily useful for traditional server deployments.
    // For serverless at scale, configure Redis via UPSTASH_REDIS_REST_URL.
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
    this.lastUsed = Date.now();
    const key = this.getKey(request);
    const now = Date.now();
    const windowEnd = now + this.config.windowMs;
    
    // Trigger cleanup more frequently if store is getting large
    // This helps prevent memory leaks in high-traffic scenarios
    if (store.size > 1000 && now - cleanupManager.getStats().lastCleanup > 60000) {
      cleanupManager.forceCleanup();
    }

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
      const counter = getCounter(this.name);
      if (allowed) counter.allowed++; else counter.blocked++;
      if (!allowed && process.env.RATE_LIMIT_LOG_ENABLED === '1') {
        // Lightweight JSON line for ingestion by log drains
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'rate_limit_block',
          limiter: this.name,
          key,
          remaining,
          reset,
          ts: new Date().toISOString(),
        }));
      }
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
    const counter = getCounter(this.name);
    if (allowed) counter.allowed++; else counter.blocked++;
    if (!allowed && process.env.RATE_LIMIT_LOG_ENABLED === '1') {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'rate_limit_block',
        limiter: this.name,
        key,
        remaining,
        reset: record.resetTime,
        ts: new Date().toISOString(),
      }));
    }
    return { allowed, remaining, resetTime: record.resetTime, totalRequests: record.count };
  }

  public createMiddleware() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const result = await this.checkLimit(request);
      
      if (!result.allowed) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded', retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000) },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': this.config.maxRequests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
              'X-RateLimit-Name': this.name,
            }
          }
        );
      }

      // Add rate limit headers to successful responses
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
      response.headers.set('X-RateLimit-Name', this.name);
      
      return null; // Continue to next handler
    };
  }
  
  // Get memory usage and performance stats for this limiter
  public getMemoryStats() {
    return {
      name: this.name,
      lastUsed: this.lastUsed,
      storeSize: store.size,
      config: {
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests
      }
    };
  }
  
  // Clear entries related to this limiter (useful for testing)
  public clearCache(): void {
    const prefix = `${this.name}:`;
    const keysToDelete: string[] = [];
    store.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => store.delete(key));
    rateLimitStats.delete(this.name);
  }
}

// Pre-configured rate limiters
export const webhookRateLimiter = new RateLimiter({
  name: 'webhook',
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
  name: 'api',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.RATE_LIMIT_RPM || '60'),
});

export const adminRateLimiter = new RateLimiter({
  name: 'admin',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.ADMIN_RATE_LIMIT_RPM || '40'),
});

// File upload rate limiter (stricter)
export const fileUploadRateLimiter = new RateLimiter({
  name: 'file_upload',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.FILE_UPLOAD_RATE_LIMIT_RPM || '10'),
});

// Submission rate limiter (moderate)
export const submissionRateLimiter = new RateLimiter({
  name: 'submission',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.SUBMISSION_RATE_LIMIT_RPM || '20'),
});

// Auth-related endpoints (stricter)
export const authRateLimiter = new RateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_PER_15MIN || '10'),
});

// Public API endpoints (moderate)
export const publicApiRateLimiter = new RateLimiter({
  name: 'public_api',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: parseInt(process.env.PUBLIC_API_RATE_LIMIT_RPM || '100'),
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
      { success: false, error: 'Rate limit exceeded', retryAfter: Math.ceil((limitResult.resetTime - Date.now()) / 1000) },
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

// Additional memory management utilities
export const memoryUtils = {
  // Get comprehensive memory usage stats
  getMemoryUsage(): {
    storeSize: number;
    statsSize: number;
    cleanupStats: ReturnType<typeof cleanupManager.getStats>;
    estimatedMemoryKB: number;
  } {
    const storeSize = store.size;
    const statsSize = rateLimitStats.size;
    
    // Rough estimate: each store entry ~100 bytes, each stat entry ~50 bytes
    const estimatedMemoryKB = Math.round((storeSize * 100 + statsSize * 50) / 1024);
    
    return {
      storeSize,
      statsSize,
      cleanupStats: cleanupManager.getStats(),
      estimatedMemoryKB
    };
  },
  
  // Force immediate cleanup of all expired entries
  forceCleanup: () => cleanupManager.forceCleanup(),
  
  // Clear all rate limit data (useful for tests or emergency cleanup)
  clearAll(): void {
    store.clear();
    rateLimitStats.clear();
  },
  
  // Get entries that are about to expire (within next 5 minutes)
  getExpiringEntries(withinMs = 5 * 60 * 1000): Array<{ key: string; expiresIn: number }> {
    const now = Date.now();
    const threshold = now + withinMs;
    const expiring: Array<{ key: string; expiresIn: number }> = [];
    
    store.forEach((record, key) => {
      if (record.resetTime <= threshold && record.resetTime > now) {
        expiring.push({
          key,
          expiresIn: record.resetTime - now
        });
      }
    });
    
    return expiring.sort((a, b) => a.expiresIn - b.expiresIn);
  }
};

// Warning: Monitor memory usage in production
if (typeof process !== 'undefined') {
  // Log memory warnings in production if store grows too large
  const memoryWarningInterval = setInterval(() => {
    const usage = memoryUtils.getMemoryUsage();
    
    // Warn if store has more than 5000 entries (indicates potential memory leak)
    if (usage.storeSize > 5000) {
      console.warn(`[RateLimit] WARNING: Large in-memory store detected. Size: ${usage.storeSize} entries, ~${usage.estimatedMemoryKB}KB. Consider using Redis for production.`);
    }
  }, 10 * 60 * 1000); // Check every 10 minutes
  
  // Clear the warning interval on process exit
  process.on('beforeExit', () => clearInterval(memoryWarningInterval));
}
