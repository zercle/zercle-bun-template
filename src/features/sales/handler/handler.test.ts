/**
 * HTTP driving-adapter tests for the sales feature. A fake `SalesService`
 * stands in for the usecase layer so the router's parsing, status codes,
 * and error envelope are exercised without a database.
 */
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErrConflict,
  ErrInvalidInput,
  ErrNotFound,
} from "../../../infrastructure/errors/app-error.ts";
import { registerSentinel } from "../../../infrastructure/errors/sentinel.ts";
import type { PurchaseResponse } from "../contract/purchase.ts";
import {
  ErrExactChangeRequired,
  ErrInsufficientPayment,
  ErrMachineNotFound,
  ErrOutOfStock,
  ErrProductNotFound,
  ErrUnsupportedCoin,
} from "../domain/errors.ts";
import type { SalesService } from "../usecase/service.ts";
import { createSalesRouter } from "./handler.ts";

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

function fixedResponse(): PurchaseResponse {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    machine_id: MACHINE_ID,
    product_id: PRODUCT_ID,
    price_cents: 50,
    total_inserted_cents: 75,
    change_cents: 25,
    change_coins: [25],
    purchased_at: "2025-01-01T00:00:00.000Z",
  };
}

function makeService(overrides: Partial<SalesService> = {}): SalesService {
  return {
    purchase: vi.fn(),
    ...overrides,
  };
}

describe("sales router (HTTP)", () => {
  beforeAll(() => {
    registerSentinel(ErrProductNotFound, ErrNotFound);
    registerSentinel(ErrMachineNotFound, ErrNotFound);
    registerSentinel(ErrOutOfStock, ErrConflict);
    registerSentinel(ErrInsufficientPayment, ErrInvalidInput);
    registerSentinel(ErrExactChangeRequired, ErrInvalidInput);
    registerSentinel(ErrUnsupportedCoin, ErrInvalidInput);
  });

  let service: SalesService;
  let app: Hono;

  beforeEach(() => {
    service = makeService();
    app = new Hono();
    app.route("/", createSalesRouter({ service }));
  });

  it("POST /purchases with valid body -> 201 + purchase response", async () => {
    const resp = fixedResponse();
    vi.mocked(service.purchase).mockResolvedValueOnce(resp);

    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50, 25] }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(resp.id);
    expect(body.change_cents).toBe(25);
    expect(body.change_coins).toEqual([25]);
    expect(service.purchase).toHaveBeenCalledWith({
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      coins: [50, 25],
    });
  });

  it("POST /purchases with malformed JSON -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.purchase).not.toHaveBeenCalled();
  });

  it("POST /purchases with missing coins -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine_id: MACHINE_ID, product_id: PRODUCT_ID }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.purchase).not.toHaveBeenCalled();
  });

  it("POST /purchases with a non-uuid id -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine_id: "not-a-uuid", product_id: PRODUCT_ID, coins: [50] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.purchase).not.toHaveBeenCalled();
  });

  it("maps ErrOutOfStock to 409 CONFLICT", async () => {
    vi.mocked(service.purchase).mockRejectedValueOnce(ErrOutOfStock);
    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("CONFLICT");
  });

  it("maps ErrProductNotFound to 404 NOT_FOUND", async () => {
    vi.mocked(service.purchase).mockRejectedValueOnce(ErrProductNotFound);
    const res = await app.request("/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("NOT_FOUND");
  });

  it("maps ErrInsufficientPayment and ErrExactChangeRequired to 400 INVALID_INPUT", async () => {
    for (const err of [ErrInsufficientPayment, ErrExactChangeRequired]) {
      vi.mocked(service.purchase).mockRejectedValueOnce(err);
      const res = await app.request("/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("INVALID_INPUT");
    }
  });
});
