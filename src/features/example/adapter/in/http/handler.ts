// STUB FEATURE — delete src/features/example to start your project.

/**
 * Driving adapter exposing the example feature over HTTP. Parses requests
 * into the wire contract, delegates to the application `ItemService` port,
 * and maps errors through the platform envelope. It never touches outbound
 * ports or driven adapters directly (enforced by `src/architecture.test.ts`).
 */
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../../../platform/errors/app-error.ts";
import { httpError } from "../../../../../platform/errors/mapper.ts";
import type { ItemService } from "../../../application/service.ts";
import { CreateItemRequest } from "../../../contract/create-item.ts";
import { ListItemsRequest } from "../../../contract/list-items.ts";
import { ErrInvalidID } from "../../../domain/errors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createExampleRouter(deps: { service: ItemService }): Hono {
  const { service } = deps;
  const router = new Hono();

  router.post("/items", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      const { status, body: errBody } = httpError(ErrInvalidInput);
      return c.json(errBody, status as 200);
    }
    const parsed = CreateItemRequest.safeParse(body);
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

  router.get("/items", async (c) => {
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
    const parsed = ListItemsRequest.safeParse(query);
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

  router.get("/items/:id", async (c) => {
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
