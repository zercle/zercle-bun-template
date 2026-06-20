import { AppError, ErrInternal } from "./app-error.ts";
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
  }

  return {
    status: ErrInternal.httpStatus,
    body: { error: ErrInternal.code, message: ErrInternal.message },
  };
}
