import type { Context, Next } from 'hono';
import type { AuthServiceInterface } from '../../features/auth/service/interface';
import { AppError, ErrUnauthorized } from '../errors/app-error';
import type { Logger } from '../telemetry/logger';

export function authMiddleware(
  authService: AuthServiceInterface,
  logger: Logger,
) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw ErrUnauthorized;
    }

    const token = authHeader.slice(7);

    try {
      const user = await authService.validateToken(token);
      c.set('userId', user.id);
      c.set('username', user.username);
    } catch (err) {
      logger.warn('authentication failed', {
        path: c.req.path,
        error: String(err),
      });
      if (err instanceof AppError) throw err;
      throw ErrUnauthorized;
    }

    await next();
  };
}

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    username: string;
  }
}
