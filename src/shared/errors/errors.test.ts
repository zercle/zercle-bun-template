import { describe, expect, it } from "vitest";
import { ErrConflict, ErrForbidden, ErrInvalidInput, ErrNotFound } from "./app-error.ts";
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
});
