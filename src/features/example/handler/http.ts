// STUB FEATURE — delete src/features/example to start your project.
import { Hono } from "hono";
import { ErrInvalidInput } from "../../../shared/errors/app-error.ts";
import { httpError } from "../../../shared/errors/mapper.ts";
import { ErrInvalidID } from "../domain/errors.ts";
import type { ItemService } from "../domain/service.ts";
import { CreateItemRequest, toItemResponse } from "../dto/create-item.ts";
import { ListItemsRequest } from "../dto/list-items.ts";

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
      const item = await service.create(parsed.data.name);
      return c.json(toItemResponse(item), 201);
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
      const items = await service.list(parsed.data.limit ?? 0, parsed.data.offset ?? 0);
      return c.json({ items: items.map(toItemResponse) }, 200);
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
      const item = await service.get(id);
      return c.json(toItemResponse(item), 200);
    } catch (err) {
      const { status, body: errBody } = httpError(err);
      return c.json(errBody, status as 200);
    }
  });

  return router;
}
