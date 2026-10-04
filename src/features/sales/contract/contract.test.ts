/**
 * Contract tests: the wire schemas in `contract/` are the published inbound
 * API surface, so their accept/reject behavior is pinned here. Mirrors the
 * Go template's `contract/contract_test.go`.
 */
import { describe, expect, it } from "vitest";
import { PurchaseRequest, PurchaseResponse } from "./purchase.ts";

const MACHINE_ID = "12345678-1234-1234-1234-123456789abc";
const PRODUCT_ID = "22345678-1234-1234-1234-123456789abc";

describe("PurchaseRequest", () => {
  it("accepts valid ids and positive coins", () => {
    const parsed = PurchaseRequest.safeParse({
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      coins: [25, 25, 50],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing, empty, or malformed machine_id", () => {
    const base = { product_id: PRODUCT_ID, coins: [5] };
    expect(PurchaseRequest.safeParse({ ...base }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, machine_id: "" }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, machine_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a missing, empty, or malformed product_id", () => {
    const base = { machine_id: MACHINE_ID, coins: [5] };
    expect(PurchaseRequest.safeParse({ ...base }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, product_id: "" }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, product_id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects missing, empty, zero, negative, or non-integer coins", () => {
    const base = { machine_id: MACHINE_ID, product_id: PRODUCT_ID };
    expect(PurchaseRequest.safeParse({ ...base }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, coins: [] }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, coins: [0] }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, coins: [-5] }).success).toBe(false);
    expect(PurchaseRequest.safeParse({ ...base, coins: [1.5] }).success).toBe(false);
  });
});

describe("PurchaseResponse", () => {
  it("parses a wire-shaped payload", () => {
    const parsed = PurchaseResponse.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      price_cents: 100,
      total_inserted_cents: 125,
      change_cents: 25,
      change_coins: [25],
      purchased_at: "2025-01-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects payloads missing fields", () => {
    expect(PurchaseResponse.safeParse({ id: "x" }).success).toBe(false);
  });

  it("carries the documented wire field names", () => {
    const keys = Object.keys(PurchaseResponse.shape);
    expect(keys).toEqual([
      "id",
      "machine_id",
      "product_id",
      "price_cents",
      "total_inserted_cents",
      "change_cents",
      "change_coins",
      "purchased_at",
    ]);
  });
});
