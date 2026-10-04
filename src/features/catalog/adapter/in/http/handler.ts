/**
 * Driving adapter exposing the catalog feature over HTTP. Parses requests
 * into the wire contract, delegates to the application `ProductService` port,
 * and maps errors through the platform envelope. It never touches outbound
 * ports or driven adapters directly (enforced by `src/architecture.test.ts`).
 */
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../../../platform/errors/app-error.ts";
import { httpError } from "../../../../../platform/errors/mapper.ts";
import type { ProductService } from "../../../application/service.ts";
import { CreateProductRequest } from "../../../contract/create-product.ts";
import { ListProductsRequest } from "../../../contract/list-products.ts";
import { ErrInvalidID } from "../../../domain/errors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createCatalogRouter(deps: { service: ProductService }): Hono {
  const { service } = deps;
  const router = new Hono();

  router.post("/products", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    const parsed = CreateProductRequest.safeParse(body);
    if (!parsed.success) {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    try {
      const resp = await service.create(parsed.data);
      return c.json(resp, 201);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  router.get("/products", async (c) => {
    const rawLimit = c.req.query("limit");
    const rawOffset = c.req.query("offset");
    const query: { limit?: number; offset?: number } = {};
    if (rawLimit !== undefined && rawLimit.length > 0) {
      const n = Number(rawLimit);
      if (!Number.isFinite(n)) {
        const { status, body: errBody } = httpError(ErrInvalidInput);
        return c.json(errBody, status as 200);
      }
      query.limit = n;
    }
    if (rawOffset !== undefined && rawOffset.length > 0) {
      const n = Number(rawOffset);
      if (!Number.isFinite(n)) {
        const { status, body: errBody } = httpError(ErrInvalidInput);
        return c.json(errBody, status as 200);
      }
      query.offset = n;
    }
    const parsed = ListProductsRequest.safeParse(query);
    if (!parsed.success) {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    try {
      const resp = await service.list(parsed.data);
      return c.json(resp, 200);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  router.get("/products/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) {
      const { status, body: errBody } = httpError(ErrInvalidID);
      return c.json(errBody, status as 200);
    }
    try {
      const resp = await service.get(id);
      return c.json(resp, 200);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  return router;
}
