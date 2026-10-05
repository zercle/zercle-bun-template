/**
 * Version-independent wire error codes carried in the
 * `{"error": code, "message": msg}` HTTP response envelope.
 *
 * Mirrors the Go template's `pkg/api/errcodes`. Values are part of the
 * published inbound contract (re-exported from `src/index.ts`): renaming or
 * removing a code is a breaking change for API consumers.
 */
export const ErrCodeCanceled = "CANCELED";
export const ErrCodeConflict = "CONFLICT";
export const ErrCodeDeadlineExceeded = "DEADLINE_EXCEEDED";
export const ErrCodeForbidden = "FORBIDDEN";
export const ErrCodeInternal = "INTERNAL";
export const ErrCodeInvalidInput = "INVALID_INPUT";
export const ErrCodeNotFound = "NOT_FOUND";
export const ErrCodeUnauthorized = "UNAUTHORIZED";
