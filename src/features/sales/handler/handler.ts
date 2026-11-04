/**
 * HTTP handler exposing the sales feature over HTTP. Parses requests into
 * the wire contract, delegates to the usecase `SalesService` interface, and
 * maps errors through the infrastructure envelope. It never touches the
 * repository or its postgres implementation directly (enforced by
 * `src/architecture.test.ts`).
 */
import { Elysia, status } from "elysia";
import { ErrInvalidInput } from "../../../shared/errors/app-error.ts";
import { errorResponse } from "../../../shared/errors/respond.ts";
import { parseJsonBody } from "../../../shared/http-body.ts";
import { PurchaseRequest } from "../contract/purchase.ts";
import type { SalesService } from "../usecase/service.ts";

export function createSalesRouter(deps: { service: SalesService }): Elysia {
  const { service } = deps;
  const router = new Elysia();

  router.post(
    "/purchases",
    async ({ request }) => {
      const body = await parseJsonBody(request);
      if (!body.ok) {
        return errorResponse(ErrInvalidInput);
      }
      const parsed = PurchaseRequest.safeParse(body.value);
      if (!parsed.success) {
        return errorResponse(ErrInvalidInput);
      }
      try {
        const resp = await service.purchase(parsed.data);
        return status(201, resp);
      } catch (err) {
        return errorResponse(err);
      }
    },
    { parse: "none" },
  );

  return router;
}
