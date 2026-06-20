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
  code: "NOT_FOUND",
  message: "resource not found",
  httpStatus: 404,
});

export const ErrInvalidInput: AppError = new AppError({
  code: "INVALID_INPUT",
  message: "invalid input",
  httpStatus: 400,
});

export const ErrUnauthorized: AppError = new AppError({
  code: "UNAUTHORIZED",
  message: "unauthorized",
  httpStatus: 401,
});

export const ErrForbidden: AppError = new AppError({
  code: "FORBIDDEN",
  message: "forbidden",
  httpStatus: 403,
});

export const ErrConflict: AppError = new AppError({
  code: "CONFLICT",
  message: "conflict",
  httpStatus: 409,
});

export const ErrInternal: AppError = new AppError({
  code: "INTERNAL",
  message: "internal error",
  httpStatus: 500,
});
