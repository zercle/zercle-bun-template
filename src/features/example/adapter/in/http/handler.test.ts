// STUB FEATURE — delete src/features/example to start your project.
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidInput, ErrNotFound } from "../../../../../platform/errors/app-error.ts";
import { registerSentinel } from "../../../../../platform/errors/sentinel.ts";
import type { ItemService } from "../../../application/service.ts";
import type { ItemResponse } from "../../../contract/create-item.ts";
import type { ListItemsResponse } from "../../../contract/list-items.ts";
import { ErrInvalidID, ErrInvalidName, ErrItemNotFound } from "../../../domain/errors.ts";
import { createExampleRouter } from "./handler.ts";

function fixedResponse(name: string): ItemResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
}

function makeService(overrides: Partial<ItemService> = {}): ItemService {
  return {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

const UUID = "11111111-1111-4111-8111-111111111111";

describe("example router (HTTP)", () => {
  beforeAll(() => {
    registerSentinel(ErrItemNotFound, ErrNotFound);
    registerSentinel(ErrInvalidName, ErrInvalidInput);
    registerSentinel(ErrInvalidID, ErrInvalidInput);
  });

  let service: ItemService;
  let app: Hono;

  beforeEach(() => {
    service = makeService();
    app = new Hono();
    app.route("/", createExampleRouter({ service }));
  });

  it("POST /items with valid body -> 201 + item response", async () => {
    const resp = fixedResponse("hello");
    vi.mocked(service.create).mockResolvedValueOnce(resp);

    const res = await app.request("/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "hello" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(body.name).toBe("hello");
    expect(body.created_at).toBe("2025-01-01T00:00:00.000Z");
    expect(body.updated_at).toBe("2025-01-01T00:00:00.000Z");
    expect(service.create).toHaveBeenCalledWith({ name: "hello" });
  });

  it("POST /items missing name -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("GET /items/:id with valid uuid -> 200 + item", async () => {
    const resp = fixedResponse("hello");
    vi.mocked(service.get).mockResolvedValueOnce(resp);

    const res = await app.request(`/items/${UUID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(body.name).toBe("hello");
    expect(service.get).toHaveBeenCalledWith(UUID);
  });

  it("GET /items/:id with invalid uuid -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/items/not-a-uuid");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.get).not.toHaveBeenCalled();
  });

  it("GET /items/:id not found -> 404 NOT_FOUND", async () => {
    vi.mocked(service.get).mockRejectedValueOnce(ErrItemNotFound);

    const res = await app.request(`/items/${UUID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("NOT_FOUND");
  });

  it("GET /items -> 200 with items array", async () => {
    const resp: ListItemsResponse = { items: [fixedResponse("a"), fixedResponse("b")] };
    vi.mocked(service.list).mockResolvedValueOnce(resp);

    const res = await app.request("/items");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.id).toBe(UUID);
    expect(body.items[1]?.name).toBe("b");
    expect(service.list).toHaveBeenCalledOnce();
  });
});
