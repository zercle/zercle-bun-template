import type { ErrorHandler } from "elysia";
import type { Logger } from "pino";
import { ErrInvalidInput, ErrNotFound } from "../../shared/errors/app-error.ts";
import { httpError } from "../../shared/errors/mapper.ts";
import { BodyTooLargeError } from "./body-limit.ts";
import { getRequestId } from "./context.ts";

/**
 * Map an unhandled error onto the shared wire envelope and log it.
 *
 * Elysia routes every thrown error to the app's `onError` handler, so this
 * hook is the single place where an error becomes an HTTP response.
 *
 * Elysia's own framework errors arrive as a `ParseError`/`ValidationError`/
 * `NotFoundError` with a `code` that identifies them; the code is absent when
 * the error was thrown by one of the lifecycle hooks themselves.
 */
export function recover(logger: Logger): ErrorHandler {
  return ({ error, code, request, path, set }) => {
    logger.error(
      {
        err: error,
        request_id: getRequestId(),
        method: request.method,
        path,
      },
      "request panic recovered",
    );

    if (error instanceof BodyTooLargeError) {
      set.status = 413;
      return { error: "INVALID_INPUT", message: "request body too large" };
    }

    if (code === "VALIDATION" || code === "PARSE") {
      const { status, body } = httpError(ErrInvalidInput);
      set.status = status;
      return body;
    }

    if (code === "NOT_FOUND") {
      const { status, body } = httpError(ErrNotFound);
      set.status = status;
      return body;
    }

    const { status, body } = httpError(error);
    set.status = status;
    return body;
  };
}
