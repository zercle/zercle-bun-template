import type { Context, Next } from 'hono';
import { randomUUID } from 'crypto';

export function createRequestIDMiddleware() {
  return async (c: Context, next: Next) => {
    const requestId = c.req.header('X-Request-ID') || randomUUID();

    c.header('X-Request-ID', requestId);
    c.set('requestId', requestId);

    await next();
  };
}

export function getRequestID(c: Context): string {
  return c.get('requestId') as string;
}
