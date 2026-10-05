/**
 * HTTP handler exposing the sales feature over HTTP. Parses requests into
 * the wire contract, delegates to the usecase `SalesService` interface, and
 * maps errors through the infrastructure envelope. It never touches the
 * repository or its postgres implementation directly (enforced by
 * `src/architecture.test.ts`).
 */
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../infrastructure/errors/app-error.ts";
import { httpError } from "../../../infrastructure/errors/mapper.ts";
import { PurchaseRequest } from "../contract/purchase.ts";
import type { SalesService } from "../usecase/service.ts";

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
