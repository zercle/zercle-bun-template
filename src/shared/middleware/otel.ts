import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";

export function otel(): MiddlewareHandler {
  const tracer = trace.getTracer("zercle-bun-template");
  return async (c, next) => {
    const routeRaw = c.req.routePath;
    const route = routeRaw && routeRaw.length > 0 ? routeRaw : c.req.path;
    return tracer.startActiveSpan(`${c.req.method} ${route}`, async (span) => {
      span.setAttribute("http.method", c.req.method);
      span.setAttribute("http.route", route);
      try {
        await next();
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.setAttribute("http.response.status_code", c.res?.status ?? 500);
        span.end();
      }
    });
  };
}
