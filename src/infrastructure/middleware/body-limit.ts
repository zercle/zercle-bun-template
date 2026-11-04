import type { PreContext } from "elysia";

/** Raised when a request body exceeds the configured limit. */
export class BodyTooLargeError extends Error {
  constructor() {
    super("request body too large");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Enforce a maximum request body size.
 *
 * The body is measured before it is parsed, so an over-sized payload is
 * rejected with 413 instead of being buffered. The declared `Content-Length`
 * is checked first; when it is absent (chunked transfer) the body is measured
 * from a clone, leaving the original stream for the parser.
 */
export function bodyLimit(limit: number): (context: PreContext) => Promise<void> {
  return async ({ request }) => {
    if (limit <= 0) {
      return;
    }

    const declared = request.headers.get("content-length");
    if (declared !== null && Number(declared) > limit) {
      throw new BodyTooLargeError();
    }

    if (request.body === null) {
      return;
    }

    const size = (await request.clone().arrayBuffer()).byteLength;
    if (size > limit) {
      throw new BodyTooLargeError();
    }
  };
}
