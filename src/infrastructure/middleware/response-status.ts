import type { Context } from "elysia";

/**
 * The context Elysia hands to an `onAfterHandle` hook: the response value is
 * already resolved, so the status the client receives can be read from it.
 */
export type MapResponseContext = Context & {
  responseValue: unknown;
};

/**
 * The status code the client will receive.
 *
 * Elysia resolves the final status from the handler's return value, so the
 * status is not always on `set.status`: a handler that used
 * `status(201, body)` encodes it in the value, and a handler that returned a
 * `Response` carries it there.
 */
export function responseStatus(context: MapResponseContext): number {
  const value = context.responseValue;

  if (value instanceof Response) {
    return value.status;
  }

  if (value !== null && typeof value === "object" && "code" in value) {
    const code = value.code;
    if (typeof code === "number") {
      return code;
    }
  }

  const status = context.set.status;
  return typeof status === "number" ? status : 200;
}
