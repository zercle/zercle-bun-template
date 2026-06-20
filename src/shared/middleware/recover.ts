import type { Context, MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import { ErrInternal } from "../errors/app-error.ts";
import { httpError } from "../errors/mapper.ts";
import { getRequestId } from "./context.ts";

export function recover(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      logRecovered(c, logger, err);
      const { status, body } = httpError(ErrInternal);
      c.res = c.json(body, status as 500);
      return;
    }
    const ctxErr = (c as Context & { error?: unknown }).error;
    if (ctxErr !== undefined) {
      logRecovered(c, logger, ctxErr);
      const { status, body } = httpError(ErrInternal);
      c.res = c.json(body, status as 500);
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
