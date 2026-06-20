/**
 * Build the shared Hono application: middleware stack, observability routes
 * (/healthz, /readyz, /metrics), and the global error handler.
 *
 * Mirrors the Go template's `internal/shared/server/http.go`:
 *   1. apply middleware in a fixed order
 *   2. register observability routes
 *   3. route unhandled errors through the shared `httpError` mapper
 */
import { Hono } from "hono";
import type pino from "pino";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
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
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
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
  app.use("*", cors(cfg));
  app.use("*", recover(logger));

  app.onError((err, c) => {
    const { status, body } = httpError(err);
    return c.json(body, status as 200);
  });

  const probeTimeoutMs = cfg.http.health_probe_timeout * 1000;

  app.get("/healthz", async (c) => {
    const ok = await Promise.race([
      health.live().then(
        () => true,
        () => false,
      ),
      withTimeout(Promise.reject(new Error("probe timeout")), probeTimeoutMs).catch(() => false),
    ]);
    if (ok) {
      return c.body(null, 200);
    }
    return c.body(null, 500);
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
