import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context } from "elysia";
import { getRequestState } from "./context.ts";
import { type MapResponseContext, responseStatus } from "./response-status.ts";

/**
 * Start a span per request, named after the matched route so the span name is
 * low-cardinality. The span is closed by the response hook, once the status
 * the client receives is known.
 */
export function otel(): (context: Context) => void {
  const tracer = trace.getTracer("zercle-bun-template");
  return ({ request, route, path }) => {
    const name = route.length > 0 ? `${request.method} ${route}` : `${request.method} ${path}`;
    const span = tracer.startSpan(name);
    span.setAttribute("http.method", request.method);
    span.setAttribute("http.route", route.length > 0 ? route : path);
    span.setStatus({ code: SpanStatusCode.UNSET });

    const state = getRequestState();
    if (state !== undefined) {
      state.span = span;
    }
  };
}

/**
 * Close the request span with the status the client received.
 */
export function otelEnd(): (context: MapResponseContext) => void {
  return (context) => {
    const state = getRequestState();
    const span = state?.span;
    if (span !== undefined) {
      const status = responseStatus(context);
      span.setAttribute("http.response.status_code", status);
      if (status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    }
  };
}
