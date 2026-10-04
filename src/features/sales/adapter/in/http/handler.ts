/**
 * Driving adapter exposing the sales feature over HTTP. Parses requests into
 * the wire contract, delegates to the application `SalesService` port, and maps
 * errors through the platform envelope. It never touches outbound ports or
 * driven adapters directly (enforced by `src/architecture.test.ts`).
 */
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../../../platform/errors/app-error.ts";
import { httpError } from "../../../../../platform/errors/mapper.ts";
import type { SalesService } from "../../../application/service.ts";
import { PurchaseRequest } from "../../../contract/purchase.ts";

export function createSalesRouter(deps: { service: SalesService }): Hono {
  const { service } = deps;
  const router = new Hono();

  router.post("/purchases", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    const parsed = PurchaseRequest.safeParse(body);
    if (!parsed.success) {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    try {
      const resp = await service.purchase(parsed.data);
      return c.json(resp, 201);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  return router;
}
