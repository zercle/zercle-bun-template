import { Elysia } from "elysia";
import type pino from "pino";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey, parseBodyLimitBytes } from "../config/config.ts";
import {
  accessLog,
  bodyLimit,
  cors,
  getRequestId,
  otel,
  otelEnd,
  recover,
  requestId,
} from "../middleware/index.ts";
import {
  type HealthRegistry,
  HealthRegistryKey,
  LoggerKey,
  metricsHandler,
} from "../telemetry/index.ts";

/** Symbol used to register the Elysia app instance in the DI container. */
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
    clearTimeout(timer);
  });
}

/**
 * Build the Elysia app with the standard middleware stack and observability
 * routes. The returned `Elysia` instance is safe to drive directly with
 * `app.handle(...)` in tests, or to hand to `Bun.serve` in production.
 */
export function buildApp(container: Container): Elysia {
  const cfg = container.resolve<Config>(ConfigKey);
  const logger = container.resolve<pino.Logger>(LoggerKey);
  const health = container.resolve<HealthRegistry>(HealthRegistryKey);

  const limitBytes = parseBodyLimitBytes(cfg.http.body_limit);

  const app = new Elysia()
    .onRequest(requestId())
    .onBeforeHandle(otel())
    .onRequest(bodyLimit(limitBytes))
    .onError(recover(logger))
    .onAfterHandle(otelEnd())
    .onAfterHandle(accessLog(logger))
    .use(cors(cfg));

  const probeTimeoutMs = cfg.http.health_probe_timeout * 1000;

  app.get("/healthz", async () => {
    try {
      await withTimeout(health.live(), probeTimeoutMs);
      return new Response(null, { status: 200 });
    } catch {
      return new Response(null, { status: 500 });
    }
  });

  app.get("/readyz", async () => {
    try {
      await withTimeout(health.ready(), probeTimeoutMs);
      return new Response(null, { status: 200 });
    } catch (err) {
      logger.warn({ err, request_id: getRequestId() }, "readiness check failed");
      return new Response(JSON.stringify({ status: "not ready" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
  });

  app.get("/metrics", metricsHandler());

  return app;
}
