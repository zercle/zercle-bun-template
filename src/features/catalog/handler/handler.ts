/**
 * HTTP handler exposing the catalog feature over HTTP. Parses requests into
 * the wire contract, delegates to the usecase `ProductService` interface, and
 * maps errors through the infrastructure envelope. It never touches the
 * repository or its postgres implementation directly (enforced by
 * `src/architecture.test.ts`).
 */
import { Elysia, status } from "elysia";
import { ErrInvalidInput } from "../../../shared/errors/app-error.ts";
import { errorResponse } from "../../../shared/errors/respond.ts";
import { parseJsonBody } from "../../../shared/http-body.ts";
import { UUID_RE } from "../../../shared/uuid.ts";
import { CreateProductRequest } from "../contract/create-product.ts";
import { ListProductsRequest } from "../contract/list-products.ts";
import { ErrInvalidID } from "../domain/errors.ts";
import type { ProductService } from "../usecase/service.ts";

export function createCatalogRouter(deps: { service: ProductService }): Elysia {
  const { service } = deps;
  const router = new Elysia();

  router.post(
    "/products",
    async ({ request }) => {
      const body = await parseJsonBody(request);
      if (!body.ok) {
        return errorResponse(ErrInvalidInput);
      }
      const parsed = CreateProductRequest.safeParse(body.value);
      if (!parsed.success) {
        return errorResponse(ErrInvalidInput);
      }
      try {
        const resp = await service.create(parsed.data);
        return status(201, resp);
      } catch (err) {
        return errorResponse(err);
      }
    },
    { parse: "none" },
  );

  router.get("/products", async ({ query }) => {
    const parsedQuery: { limit?: number; offset?: number } = {};
    const rawLimit = query.limit;
    const rawOffset = query.offset;
    if (rawLimit !== undefined && rawLimit.length > 0) {
      const n = Number(rawLimit);
      if (!Number.isFinite(n)) {
        return errorResponse(ErrInvalidInput);
      }
      parsedQuery.limit = n;
    }
    if (rawOffset !== undefined && rawOffset.length > 0) {
      const n = Number(rawOffset);
      if (!Number.isFinite(n)) {
        return errorResponse(ErrInvalidInput);
      }
      parsedQuery.offset = n;
    }
    const parsed = ListProductsRequest.safeParse(parsedQuery);
    if (!parsed.success) {
      return errorResponse(ErrInvalidInput);
    }
    try {
      return await service.list(parsed.data);
    } catch (err) {
      return errorResponse(err);
    }
  });

  router.get("/products/:id", async ({ params }) => {
    const id = params.id;
    if (!UUID_RE.test(id)) {
      return errorResponse(ErrInvalidID);
    }
    try {
      return await service.get(id);
    } catch (err) {
      return errorResponse(err);
    }
  });

  return router;
}
