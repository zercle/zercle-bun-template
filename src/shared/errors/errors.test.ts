import { describe, expect, it } from "vitest";
import {
  ErrCanceled,
  ErrConflict,
  ErrDeadlineExceeded,
  ErrForbidden,
  ErrInvalidInput,
  ErrNotFound,
} from "./app-error.ts";
import { httpError } from "./mapper.ts";
import { registerSentinel } from "./sentinel.ts";

describe("httpError", () => {
  it("returns 200 ok for null", () => {
    const result = httpError(null);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });

  it("returns 200 ok for undefined", () => {
    const result = httpError(undefined);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok" });
  });

  it("maps an AppError sentinel directly", () => {
    const result = httpError(ErrNotFound);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: "NOT_FOUND",
      message: "resource not found",
    });
  });

  it("returns INTERNAL 500 for an unregistered plain Error", () => {
    const result = httpError(new Error("boom"));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "INTERNAL", message: "internal error" });
  });

  it("maps a registered domain sentinel", () => {
    const domainErr = new Error("item not found");
    registerSentinel(domainErr, ErrNotFound);
    const result = httpError(domainErr);
    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: "NOT_FOUND",
      message: "resource not found",
    });
  });

  it("walks the cause chain to find a registered sentinel", () => {
    const domainErr = new Error("item not found");
    registerSentinel(domainErr, ErrInvalidInput);
    const wrapper = new Error("wrap", { cause: domainErr });
    const result = httpError(wrapper);
    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: "INVALID_INPUT",
      message: "invalid input",
    });
  });

  it("respects registration order: first registered wins", () => {
    const target = new Error("shared target");
    registerSentinel(target, ErrForbidden);
    registerSentinel(target, ErrConflict);
    const result = httpError(target);
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: "FORBIDDEN", message: "forbidden" });
  });

  it("returns INTERNAL for non-Error throwables", () => {
    const result = httpError("string thrown");
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "INTERNAL", message: "internal error" });
  });

  it("never throws", () => {
    expect(() => httpError(null)).not.toThrow();
    expect(() => httpError(ErrNotFound)).not.toThrow();
    expect(() => httpError(new Error("x"))).not.toThrow();
    expect(() => httpError(42)).not.toThrow();
    expect(() => httpError({ weird: "thing" })).not.toThrow();
  });

  it("preserves identity check: same sentinel instance returns same AppError fields", () => {
    const domainErr = new Error("conflict in repo");
    registerSentinel(domainErr, ErrConflict);
    const result = httpError(domainErr);
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: "CONFLICT", message: "conflict" });
  });

  it("maps an AbortError (Error subclass) to 499 CANCELED", () => {
    const result = httpError(new Error("aborted"));
    const err = new Error("aborted");
    err.name = "AbortError";
    const mapped = httpError(err);
    expect(mapped.status).toBe(499);
    expect(mapped.body).toEqual({ error: "CANCELED", message: "request canceled" });
    expect(result.status).toBe(500);
  });

  it("maps a DOMException with name AbortError to 499 CANCELED", () => {
    const err = new DOMException("aborted", "AbortError");
    const result = httpError(err);
    expect(result.status).toBe(499);
    expect(result.body).toEqual({ error: "CANCELED", message: "request canceled" });
  });

  it("maps a DOMException with name TimeoutError to 504 DEADLINE_EXCEEDED", () => {
    const err = new DOMException("timed out", "TimeoutError");
    const result = httpError(err);
    expect(result.status).toBe(504);
    expect(result.body).toEqual({ error: "DEADLINE_EXCEEDED", message: "deadline exceeded" });
  });

  it("ErrCanceled has HTTP status 499 and code CANCELED", () => {
    expect(ErrCanceled.httpStatus).toBe(499);
    expect(ErrCanceled.code).toBe("CANCELED");
  });

  it("ErrDeadlineExceeded has HTTP status 504 and code DEADLINE_EXCEEDED", () => {
    expect(ErrDeadlineExceeded.httpStatus).toBe(504);
    expect(ErrDeadlineExceeded.code).toBe("DEADLINE_EXCEEDED");
  });

  it("context-error branches run before the INTERNAL fallback", () => {
    const err = new DOMException("aborted", "AbortError");
    const result = httpError(err);
    expect(result.status).toBe(499);
    expect(result.status).not.toBe(500);
  });
});
