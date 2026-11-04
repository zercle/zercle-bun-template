import type { PreContext } from "elysia";
import { enterRequestState } from "./context.ts";

export const REQUEST_ID_HEADER = "X-Request-ID";

export const MAX_REQUEST_ID_LEN = 128;

const VALID_CHARSET = /^[A-Za-z0-9_-]+$/;

function isValidRequestId(id: string): boolean {
  if (id.length === 0 || id.length > MAX_REQUEST_ID_LEN) {
    return false;
  }
  return VALID_CHARSET.test(id);
}

/**
 * Generate or validate the request id, echo it on the response, and bind it to
 * the request context so the logger and the error mapper can read it.
 */
export function requestId(): (context: PreContext) => void {
  return ({ request, set }) => {
    const incoming = request.headers.get(REQUEST_ID_HEADER) ?? "";
    const id = isValidRequestId(incoming) ? incoming : crypto.randomUUID();

    set.headers[REQUEST_ID_HEADER] = id;
    enterRequestState({ requestId: id, startedAt: performance.now() });
  };
}
