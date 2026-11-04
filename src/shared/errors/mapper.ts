import { AppError, ErrCanceled, ErrDeadlineExceeded, ErrInternal } from "./app-error.ts";
import { sentinelFor } from "./sentinel.ts";

export interface HttpErrorBody {
  error: string;
  message: string;
}

export interface HttpErrorResult {
  status: number;
  body: HttpErrorBody | { status: string };
}

export function httpError(err: unknown): HttpErrorResult {
  if (err === null || err === undefined) {
    return { status: 200, body: { status: "ok" } };
  }

  if (err instanceof AppError) {
    return {
      status: err.httpStatus,
      body: { error: err.code, message: err.message },
    };
  }

  if (err instanceof Error) {
    const mapped = sentinelFor(err);
    if (mapped !== undefined) {
      return {
        status: mapped.httpStatus,
        body: { error: mapped.code, message: mapped.message },
      };
    }

    if (isDeadline(err)) {
      return {
        status: ErrDeadlineExceeded.httpStatus,
        body: { error: ErrDeadlineExceeded.code, message: ErrDeadlineExceeded.message },
      };
    }
    if (isCanceled(err)) {
      return {
        status: ErrCanceled.httpStatus,
        body: { error: ErrCanceled.code, message: ErrCanceled.message },
      };
    }
  }

  return {
    status: ErrInternal.httpStatus,
    body: { error: ErrInternal.code, message: ErrInternal.message },
  };
}

/**
 * Bun/Node don't have a single `context.DeadlineExceeded` sentinel. Detect
 * `TimeoutError` (DOMException) and the `AbortError` family before falling
 * back to INTERNAL. Mirrors the Go template's `errors.Is(err, context.DeadlineExceeded)` branch.
 */
function isDeadline(err: Error): boolean {
  if (err.name === "TimeoutError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "TimeoutError";
  }
  return false;
}

/**
 * Mirrors the Go template's `errors.Is(err, context.Canceled)` branch. Bun/Node
 * surface cancellation as `AbortError` (Error subclass) or `DOMException`
 * with name `AbortError`.
 */
function isCanceled(err: Error): boolean {
  if (err.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError";
  }
  return false;
}
