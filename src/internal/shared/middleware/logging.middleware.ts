import type { Context, Next } from 'hono';
import type { Logger } from '../telemetry/logger';

export function loggingMiddleware(logger: Logger) {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    logger.info('request completed', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: duration,
      requestId: c.get('requestId'),
    });
  };
}
