import {
  ErrCodeCanceled,
  ErrCodeConflict,
  ErrCodeDeadlineExceeded,
  ErrCodeForbidden,
  ErrCodeInternal,
  ErrCodeInvalidInput,
  ErrCodeNotFound,
  ErrCodeUnauthorized,
} from "./errcodes.ts";

export interface AppErrorParams {
  code: string;
  message: string;
  httpStatus: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(params: AppErrorParams) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export const ErrNotFound: AppError = new AppError({
  code: ErrCodeNotFound,
  message: "resource not found",
  httpStatus: 404,
});

export const ErrInvalidInput: AppError = new AppError({
  code: ErrCodeInvalidInput,
  message: "invalid input",
  httpStatus: 400,
});

export const ErrUnauthorized: AppError = new AppError({
  code: ErrCodeUnauthorized,
  message: "unauthorized",
  httpStatus: 401,
});

export const ErrForbidden: AppError = new AppError({
  code: ErrCodeForbidden,
  message: "forbidden",
  httpStatus: 403,
});

export const ErrConflict: AppError = new AppError({
  code: ErrCodeConflict,
  message: "conflict",
  httpStatus: 409,
});

export const ErrCanceled: AppError = new AppError({
  code: ErrCodeCanceled,
  message: "request canceled",
  httpStatus: 499,
});

export const ErrDeadlineExceeded: AppError = new AppError({
  code: ErrCodeDeadlineExceeded,
  message: "deadline exceeded",
  httpStatus: 504,
});

export const ErrInternal: AppError = new AppError({
  code: ErrCodeInternal,
  message: "internal error",
  httpStatus: 500,
});
