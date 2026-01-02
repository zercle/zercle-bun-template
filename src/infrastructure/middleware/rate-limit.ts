import { Context, Next } from 'hono';
import { RateLimitConfig } from '../config/config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const clientId = c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP') || 'unknown';
    const now = Date.now();
    const windowMs = config.window * 1000;

    let entry = rateLimitMap.get(clientId);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(clientId, entry);
    }

    entry.count++;

    const remaining = Math.max(0, config.requests - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000);

    c.header('X-RateLimit-Limit', config.requests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetTime.toString());

    if (entry.count > config.requests) {
      return c.json(
        {
          status: 'error',
          message: 'Rate limit exceeded',
        },
        429
      );
    }

    await next();
  };
}
