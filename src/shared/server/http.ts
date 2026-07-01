/**
 * Build the shared Hono application: middleware stack, observability routes
 * (/healthz, /readyz, /metrics), and the global error handler.
 *
 * Mirrors the Go template's `internal/shared/server/http.go`:
 *   1. apply middleware in a fixed order
 *   2. register observability routes
 *   3. route unhandled errors through the shared `httpError` mapper
 */
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import type pino from "pino";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey, parseBodyLimitBytes } from "../../config/config.ts";
import { httpError } from "../errors/mapper.ts";
import { accessLog, cors, getRequestId, otel, recover, requestId } from "../middleware/index.ts";
import {
  type HealthRegistry,
  HealthRegistryKey,
  LoggerKey,
  metricsHandler,
} from "../telemetry/index.ts";

/** Symbol used to register the Hono app instance in the DI container. */
export const AppKey = Symbol("App");

/**
 * Race `p` against a timer that rejects after `ms` milliseconds. The rejection
 * propagates as a plain `Error("probe timeout")` so the caller's existing error
 * handling (mapper, logger) does not need to special-case timers.
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("probe timeout")), ms);
  });
  // Attach a persistent handler so a late rejection from `p` (after the
  // timeout has already settled the race) does not surface as an
  // unhandledRejection. The race result is unaffected.
  p.catch(() => {});
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Enforce a maximum request body size in bytes. Delegates to Hono's built-in
 * `bodyLimit`, which wraps the request body stream — so the limit is enforced
 * even when the client omits `Content-Length` (e.g. chunked transfer encoding).
 * Over-limit requests short-circuit with 413 + an AppError-shaped JSON body.
 */
export function bodyLimit(limit: number): MiddlewareHandler {
  return honoBodyLimit({
    maxSize: limit,
    onError: (c) => {
      return c.json({ error: "INVALID_INPUT", message: "request body too large" }, 413);
    },
  });
}

/**
 * Build the Hono app with the standard middleware stack and observability
 * routes. The returned `Hono` instance is safe to drive directly with
 * `app.request(...)` in tests, or to hand to `Bun.serve` in production.
 */
export function buildApp(container: Container): Hono {
  const cfg = container.resolve<Config>(ConfigKey);
  const logger = container.resolve<pino.Logger>(LoggerKey);
  const health = container.resolve<HealthRegistry>(HealthRegistryKey);

  const app = new Hono();

  app.use("*", requestId());
  app.use("*", otel());
  app.use("*", accessLog(logger));
  app.use("*", recover(logger));
  app.use("*", cors(cfg));
  const limitBytes = parseBodyLimitBytes(cfg.http.body_limit);
  if (limitBytes > 0) {
    app.use("*", bodyLimit(limitBytes));
  }

  app.onError((err, c) => {
    const { status, body } = httpError(err);
    return c.json(body, status as 200);
  });

  const probeTimeoutMs = cfg.http.health_probe_timeout * 1000;

  app.get("/healthz", async (c) => {
    try {
      await withTimeout(health.live(), probeTimeoutMs);
      return c.body(null, 200);
    } catch {
      return c.body(null, 500);
    }
  });

  app.get("/readyz", async (c) => {
    try {
      await withTimeout(health.ready(), probeTimeoutMs);
      return c.body(null, 200);
    } catch (err) {
      logger.warn({ err, request_id: getRequestId() }, "readiness check failed");
      return c.json({ status: "not ready" }, 503);
    }
  });

  app.get("/metrics", metricsHandler());

  return app;
}
