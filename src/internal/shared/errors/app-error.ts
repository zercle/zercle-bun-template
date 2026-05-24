export enum ErrorCode {
  // Common
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  INVALID_INPUT = 'INVALID_INPUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  // Auth
  USERNAME_REQUIRED = 'USERNAME_REQUIRED',
  EMAIL_REQUIRED = 'EMAIL_REQUIRED',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  PASSWORD_TOO_SHORT = 'PASSWORD_TOO_SHORT',
  INVALID_EMAIL = 'INVALID_EMAIL',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  // Chat
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  ROOM_NAME_REQUIRED = 'ROOM_NAME_REQUIRED',
  INVALID_ROOM_TYPE = 'INVALID_ROOM_TYPE',
  MESSAGE_CONTENT_REQUIRED = 'MESSAGE_CONTENT_REQUIRED',
  ALREADY_JOINED = 'ALREADY_JOINED',
  NOT_MEMBER = 'NOT_MEMBER',
}

export class AppError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return { code: this.code, message: this.message };
  }
}

// Sentinel errors (matching Go's errors.go)
export const ErrNotFound = new AppError(
  ErrorCode.NOT_FOUND,
  'resource not found',
);
export const ErrUnauthorized = new AppError(
  ErrorCode.UNAUTHORIZED,
  'unauthorized',
);
export const ErrForbidden = new AppError(ErrorCode.FORBIDDEN, 'forbidden');
export const ErrAlreadyExists = new AppError(
  ErrorCode.ALREADY_EXISTS,
  'resource already exists',
);
export const ErrInvalidInput = new AppError(
  ErrorCode.INVALID_INPUT,
  'invalid input',
);
export const ErrInternalError = new AppError(
  ErrorCode.INTERNAL_ERROR,
  'internal error',
);

export const ErrUsernameRequired = new AppError(
  ErrorCode.USERNAME_REQUIRED,
  'username is required',
);
export const ErrEmailRequired = new AppError(
  ErrorCode.EMAIL_REQUIRED,
  'email is required',
);
export const ErrPasswordRequired = new AppError(
  ErrorCode.PASSWORD_REQUIRED,
  'password is required',
);
export const ErrPasswordTooShort = new AppError(
  ErrorCode.PASSWORD_TOO_SHORT,
  'password must be at least 8 characters',
);
export const ErrInvalidEmail = new AppError(
  ErrorCode.INVALID_EMAIL,
  'invalid email format',
);
export const ErrUserNotFound = new AppError(
  ErrorCode.USER_NOT_FOUND,
  'user not found',
);
export const ErrInvalidCredentials = new AppError(
  ErrorCode.INVALID_CREDENTIALS,
  'invalid credentials',
);
export const ErrTokenExpired = new AppError(
  ErrorCode.TOKEN_EXPIRED,
  'token expired',
);
export const ErrTokenInvalid = new AppError(
  ErrorCode.TOKEN_INVALID,
  'token invalid',
);
export const ErrRoomNotFound = new AppError(
  ErrorCode.ROOM_NOT_FOUND,
  'room not found',
);
export const ErrMessageNotFound = new AppError(
  ErrorCode.MESSAGE_NOT_FOUND,
  'message not found',
);
export const ErrRoomNameRequired = new AppError(
  ErrorCode.ROOM_NAME_REQUIRED,
  'room name is required',
);
export const ErrInvalidRoomType = new AppError(
  ErrorCode.INVALID_ROOM_TYPE,
  'invalid room type',
);
export const ErrMessageContentRequired = new AppError(
  ErrorCode.MESSAGE_CONTENT_REQUIRED,
  'message content is required',
);
export const ErrAlreadyJoined = new AppError(
  ErrorCode.ALREADY_JOINED,
  'already joined room',
);
export const ErrNotMember = new AppError(
  ErrorCode.NOT_MEMBER,
  'not a member of room',
);
