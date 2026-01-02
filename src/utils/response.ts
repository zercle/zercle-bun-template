import type { Context } from 'hono';

export interface JSendResponse<T = unknown> {
  status: 'success' | 'fail' | 'error';
  data?: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    offset?: number;
  };
}

export function success<T>(c: Context, data: T, meta?: JSendResponse<T>['meta']) {
  const response: JSendResponse<T> = {
    status: 'success',
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return c.json(response, 200);
}

export function created<T>(c: Context, data: T) {
  const response: JSendResponse<T> = {
    status: 'success',
    data,
  };

  return c.json(response, 201);
}

export function noContent(c: Context) {
  return c.json({ status: 'success' }, 204);
}

export function badRequest(c: Context, message: string, errors?: Record<string, string[]>) {
  const response: JSendResponse = {
    status: 'fail',
    message,
  };

  if (errors) {
    (response as any).errors = errors;
  }

  return c.json(response, 400);
}

export function unauthorized(c: Context, message: string) {
  const response: JSendResponse = {
    status: 'fail',
    message,
  };

  return c.json(response, 401);
}

export function forbidden(c: Context, message: string) {
  const response: JSendResponse = {
    status: 'fail',
    message,
  };

  return c.json(response, 403);
}

export function notFound(c: Context, message: string) {
  const response: JSendResponse = {
    status: 'fail',
    message,
  };

  return c.json(response, 404);
}

export function conflict(c: Context, message: string) {
  const response: JSendResponse = {
    status: 'fail',
    message,
  };

  return c.json(response, 409);
}

export function internalError(c: Context, message: string) {
  const response: JSendResponse = {
    status: 'error',
    message,
  };

  return c.json(response, 500);
}

export function errorResponse(c: Context, status: number, message: string) {
  const response: JSendResponse = {
    status: status >= 500 ? 'error' : 'fail',
    message,
  };

  return c.json(response, status);
}
