/**
 * HTTP handler exposing the reporting feature over HTTP. Parses requests
 * into the wire contract, delegates to the usecase `ReportingService`
 * interface, and maps errors through the infrastructure envelope. It never
 * touches the repository or its postgres implementation directly (enforced by
 * `src/architecture.test.ts`).
 */
import { Elysia } from "elysia";
import { ErrInvalidInput } from "../../../shared/errors/app-error.ts";
import { errorResponse } from "../../../shared/errors/respond.ts";
import { SummaryRequest } from "../contract/summary.ts";
import type { ReportingService } from "../usecase/service.ts";

export function createReportingRouter(deps: { service: ReportingService }): Elysia {
  const { service } = deps;
  const router = new Elysia();

  router.get("/reports/summary", async ({ query }) => {
    const parsedQuery: { top?: number } = {};
    const rawTop = query.top;
    if (rawTop !== undefined && rawTop.length > 0) {
      const n = Number(rawTop);
      if (!Number.isFinite(n)) {
        return errorResponse(ErrInvalidInput);
      }
      parsedQuery.top = n;
    }
    const parsed = SummaryRequest.safeParse(parsedQuery);
    if (!parsed.success) {
      return errorResponse(ErrInvalidInput);
    }
    try {
      return await service.summary(parsed.data);
    } catch (err) {
      return errorResponse(err);
    }
  });

  return router;
}
