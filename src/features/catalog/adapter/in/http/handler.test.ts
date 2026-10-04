/**
 * Unit tests for the catalog HTTP adapter. A hand-written fake `ProductService`
 * (vi.fn methods) stands in for the application layer; a real `Hono` instance
 * routes requests through the router. The error envelope is exercised by
 * registering the feature sentinels against the platform AppErrors.
 */
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidInput, ErrNotFound } from "../../../../../platform/errors/app-error.ts";
import { registerSentinel } from "../../../../../platform/errors/sentinel.ts";
import type { ProductService } from "../../../application/service.ts";
import type { ProductResponse } from "../../../contract/create-product.ts";
import type { ListProductsResponse } from "../../../contract/list-products.ts";
import {
  ErrInvalidID,
  ErrInvalidPrice,
  ErrInvalidProductName,
  ErrProductNotFound,
} from "../../../domain/errors.ts";
import { createCatalogRouter } from "./handler.ts";

function fixedResponse(name: string): ProductResponse {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    price_cents: 250,
    stock: 3,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
}

function makeService(overrides: Partial<ProductService> = {}): ProductService {
  return {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    ...overrides,
  };
}

const UUID = "11111111-1111-4111-8111-111111111111";

describe("catalog router (HTTP)", () => {
  beforeAll(() => {
    registerSentinel(ErrProductNotFound, ErrNotFound);
    registerSentinel(ErrInvalidID, ErrInvalidInput);
    registerSentinel(ErrInvalidProductName, ErrInvalidInput);
    registerSentinel(ErrInvalidPrice, ErrInvalidInput);
  });

  let service: ProductService;
  let app: Hono;

  beforeEach(() => {
    service = makeService();
    app = new Hono();
    app.route("/", createCatalogRouter({ service }));
  });

  it("POST /products with valid body -> 201 + product response", async () => {
    const resp = fixedResponse("widget");
    vi.mocked(service.create).mockResolvedValueOnce(resp);

    const res = await app.request("/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "widget", price_cents: 250, stock: 3 }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(body.name).toBe("widget");
    expect(body.price_cents).toBe(250);
    expect(service.create).toHaveBeenCalledWith({ name: "widget", price_cents: 250, stock: 3 });
  });

  it("POST /products missing name -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ price_cents: 250 }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST /products with invalid JSON -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
  });

  it("POST /products maps ErrInvalidProductName -> 400 INVALID_INPUT", async () => {
    vi.mocked(service.create).mockRejectedValueOnce(ErrInvalidProductName);

    const res = await app.request("/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "widget", price_cents: 250, stock: 3 }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
  });

  it("GET /products/:id with valid uuid -> 200 + product", async () => {
    const resp = fixedResponse("widget");
    vi.mocked(service.get).mockResolvedValueOnce(resp);

    const res = await app.request(`/products/${UUID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(body.name).toBe("widget");
    expect(service.get).toHaveBeenCalledWith(UUID);
  });

  it("GET /products/:id with invalid uuid -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/products/not-a-uuid");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.get).not.toHaveBeenCalled();
  });

  it("GET /products/:id not found -> 404 NOT_FOUND", async () => {
    vi.mocked(service.get).mockRejectedValueOnce(ErrProductNotFound);

    const res = await app.request(`/products/${UUID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("NOT_FOUND");
  });

  it("GET /products -> 200 with products array", async () => {
    const resp: ListProductsResponse = { products: [fixedResponse("a"), fixedResponse("b")] };
    vi.mocked(service.list).mockResolvedValueOnce(resp);

    const res = await app.request("/products");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { products: Array<Record<string, unknown>> };
    expect(body.products).toHaveLength(2);
    expect(body.products[0]?.id).toBe(UUID);
    expect(body.products[1]?.name).toBe("b");
    expect(service.list).toHaveBeenCalledOnce();
  });

  it("GET /products?limit=abc -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/products?limit=abc");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.list).not.toHaveBeenCalled();
  });
});
