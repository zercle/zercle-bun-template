import type { Context, MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import { httpError } from "../errors/mapper.ts";
import { getRequestId } from "./context.ts";

export function recover(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      logRecovered(c, logger, err);
      const { status, body } = httpError(err);
      return c.json(body, status as 200);
    }
    const ctxErr = c.error;
    if (ctxErr !== undefined) {
      logRecovered(c, logger, ctxErr);
      const { status, body } = httpError(ctxErr);
      c.error = undefined;
      return c.json(body, status as 200);
    }
  };
}

function logRecovered(c: Context, logger: Logger, err: unknown): void {
  logger.error(
    {
      err,
      request_id: getRequestId(),
      method: c.req.method,
      path: c.req.path,
    },
    "request panic recovered",
  );
}
