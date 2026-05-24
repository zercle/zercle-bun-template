import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';

export function requestIdMiddleware(c: Context, next: Next) {
  const requestId = c.req.header('X-Request-ID') ?? randomUUID();
  c.header('X-Request-ID', requestId);
  c.set('requestId', requestId);
  return next();
}

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}
