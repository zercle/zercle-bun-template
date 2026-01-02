import type { Context, Next } from "hono";
import type { Logger } from "../logger/logger.js";
import { getRequestID } from "./request-id.js";

export function createLoggerMiddleware(logger: Logger) {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const requestId = getRequestID(c);

    logger.info("Request started", {
      request_id: requestId,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
    });

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info("Request completed", {
      request_id: requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      duration: `${duration}ms`,
    });
  };
}
