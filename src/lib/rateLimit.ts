/**
 * Rate limiting — works in Edge runtime without Redis
 * Uses in-memory sliding window for prototype; swap to Upstash Redis in production.
 *
 * Production swap:
 *   import { Ratelimit } from '@upstash/ratelimit';
 *   import { Redis } from '@upstash/redis';
 *   const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '10s') });
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSeconds };
  }

  if (entry.count >= limit) {
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

// Preset limiters
export const loginRateLimit = (ip: string) =>
  rateLimit(`login:${ip}`, 5, 60);           // 5 attempts per minute

export const portalRateLimit = (ip: string) =>
  rateLimit(`portal:${ip}`, 20, 60);          // 20 portal loads per minute

export const apiRateLimit = (ip: string) =>
  rateLimit(`api:${ip}`, 60, 60);             // 60 API calls per minute

export const pdfRateLimit = (ip: string) =>
  rateLimit(`pdf:${ip}`, 10, 300);            // 10 PDF exports per 5 minutes
