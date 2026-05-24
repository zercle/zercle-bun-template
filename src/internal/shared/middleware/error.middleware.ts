import type { Context, Next } from 'hono';
import { AppError, ErrorCode } from '../errors/app-error';
import type { Logger } from '../telemetry/logger';

function httpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.NOT_FOUND:
    case ErrorCode.USER_NOT_FOUND:
    case ErrorCode.ROOM_NOT_FOUND:
    case ErrorCode.MESSAGE_NOT_FOUND:
      return 404;
    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.ALREADY_JOINED:
      return 409;
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.TOKEN_INVALID:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.USERNAME_REQUIRED:
    case ErrorCode.EMAIL_REQUIRED:
    case ErrorCode.PASSWORD_REQUIRED:
    case ErrorCode.PASSWORD_TOO_SHORT:
    case ErrorCode.INVALID_EMAIL:
    case ErrorCode.ROOM_NAME_REQUIRED:
    case ErrorCode.INVALID_ROOM_TYPE:
    case ErrorCode.MESSAGE_CONTENT_REQUIRED:
      return 400;
    default:
      return 500;
  }
}

export function errorMiddleware(logger: Logger) {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn('application error', {
          code: err.code,
          message: err.message,
          path: c.req.path,
        });
        return new Response(
          JSON.stringify({ error: { code: err.code, message: err.message } }),
          {
            status: httpStatus(err.code),
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      logger.error('unhandled error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        path: c.req.path,
      });

      return c.json(
        {
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'internal server error',
          },
        },
        500,
      );
    }
    return;
  };
}
