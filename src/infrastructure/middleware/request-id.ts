import type { MiddlewareHandler } from "hono";
import { runWithRequestId } from "./context.ts";

export const REQUEST_ID_HEADER = "X-Request-ID";

export const MAX_REQUEST_ID_LEN = 128;

const VALID_CHARSET = /^[A-Za-z0-9_-]+$/;

function isValidRequestId(id: string): boolean {
  if (id.length === 0 || id.length > MAX_REQUEST_ID_LEN) {
    return false;
  }
  return VALID_CHARSET.test(id);
}

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER) ?? "";
    const id = isValidRequestId(incoming) ? incoming : crypto.randomUUID();

    c.header(REQUEST_ID_HEADER, id);

    await runWithRequestId(id, async () => {
      await next();
    });
  };
}
