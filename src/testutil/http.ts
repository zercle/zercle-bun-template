/**
 * The part of an Elysia app a test needs: the ability to handle a request.
 *
 * Elysia's generic type is invariant, so the concrete `Elysia` type would
 * not accept every configured app; the structural shape does.
 */
export interface RequestHandler {
  handle(request: Request): Promise<Response> | Response;
}

/**
 * Drive an Elysia app the way a client would.
 *
 * Elysia exposes `handle(request)` rather than Hono's `app.request(path, init)`,
 * so tests build a `Request` with an absolute URL and hand it over.
 */
export function request(app: RequestHandler, path: string, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.handle(new Request(`http://localhost${path}`, init)));
}
