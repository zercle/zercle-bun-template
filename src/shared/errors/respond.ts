import { httpError } from "./mapper.ts";

/**
 * Render a mapped error as the shared wire envelope.
 *
 * Uses only the web-standard `Response`, so it stays dependency-free and can
 * be shared by every HTTP adapter without pulling a framework into the
 * shared layer.
 */
export function errorResponse(err: unknown): Response {
  const { status, body } = httpError(err);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
