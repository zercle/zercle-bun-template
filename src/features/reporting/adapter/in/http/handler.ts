/**
 * Driving adapter exposing the reporting feature over HTTP. Parses requests
 * into the wire contract, delegates to the application `ReportingService`
 * port, and maps errors through the platform envelope. It never touches
 * outbound ports or driven adapters directly (enforced by
 * `src/architecture.test.ts`).
 */
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../../../platform/errors/app-error.ts";
import { httpError } from "../../../../../platform/errors/mapper.ts";
import type { ReportingService } from "../../../application/service.ts";
import { SummaryRequest } from "../../../contract/summary.ts";

export function createReportingRouter(deps: { service: ReportingService }): Hono {
  const { service } = deps;
  const router = new Hono();

  router.get("/reports/summary", async (c) => {
    const rawTop = c.req.query("top");
    const query: { top?: number } = {};
    if (rawTop !== undefined && rawTop.length > 0) {
      const n = Number(rawTop);
      if (!Number.isFinite(n)) {
        const { status, body: errBody } = httpError(ErrInvalidInput);
        return c.json(errBody, status as 200);
      }
      query.top = n;
    }
    const parsed = SummaryRequest.safeParse(query);
    if (!parsed.success) {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    try {
      const resp = await service.summary(parsed.data);
      return c.json(resp, 200);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  return router;
}
