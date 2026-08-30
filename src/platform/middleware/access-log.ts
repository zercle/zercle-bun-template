import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import { getRequestId } from "./context.ts";

export function accessLog(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    const status = c.res.status;
    logger.info(
      {
        request_id: getRequestId(),
        method: c.req.method,
        path: c.req.path,
        status,
        latency_ms: Math.round(performance.now() - start),
      },
      "http request",
    );
  };
}
