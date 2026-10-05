/**
 * Contract tests: the wire schemas in `contract/` are the published inbound
 * API surface, so their accept/reject behavior is pinned here. Mirrors the
 * Go template's `contract/contract_test.go`.
 */
import { describe, expect, it } from "vitest";
import { CreateProductRequest, ProductResponse } from "./create-product.ts";
import { ListProductsRequest, ListProductsResponse } from "./list-products.ts";

describe("CreateProductRequest", () => {
  it("accepts a valid product", () => {
    expect(
      CreateProductRequest.safeParse({ name: "Cola", price_cents: 150, stock: 3 }).success,
    ).toBe(true);
  });

  it("defaults stock to 0 when omitted", () => {
    const parsed = CreateProductRequest.safeParse({ name: "Cola", price_cents: 150 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stock).toBe(0);
    }
  });

  it("rejects a missing or empty name", () => {
    expect(CreateProductRequest.safeParse({ price_cents: 150 }).success).toBe(false);
    expect(CreateProductRequest.safeParse({ name: "", price_cents: 150 }).success).toBe(false);
  });

  it("rejects a non-positive or non-integer price", () => {
    expect(CreateProductRequest.safeParse({ name: "Cola", price_cents: 0 }).success).toBe(false);
    expect(CreateProductRequest.safeParse({ name: "Cola", price_cents: -1 }).success).toBe(false);
    expect(CreateProductRequest.safeParse({ name: "Cola", price_cents: 1.5 }).success).toBe(false);
  });

  it("rejects a negative stock", () => {
    expect(
      CreateProductRequest.safeParse({ name: "Cola", price_cents: 150, stock: -1 }).success,
    ).toBe(false);
  });
});

describe("ListProductsRequest", () => {
  it("accepts empty pagination (both fields optional)", () => {
    expect(ListProductsRequest.safeParse({}).success).toBe(true);
  });

  it("accepts non-negative integer pagination (upper bound is configurable)", () => {
    expect(ListProductsRequest.safeParse({ limit: 20, offset: 40 }).success).toBe(true);
    expect(ListProductsRequest.safeParse({ limit: 100_000 }).success).toBe(true);
  });

  it("rejects negative or non-integer pagination", () => {
    expect(ListProductsRequest.safeParse({ limit: -1 }).success).toBe(false);
    expect(ListProductsRequest.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(ListProductsRequest.safeParse({ offset: -1 }).success).toBe(false);
  });
});

describe("ProductResponse / ListProductsResponse", () => {
  it("round-trips a wire-shaped payload", () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Cola",
      price_cents: 150,
      stock: 3,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };
    expect(ProductResponse.safeParse(product).success).toBe(true);
    expect(ListProductsResponse.safeParse({ products: [product] }).success).toBe(true);
  });

  it("rejects payloads missing fields", () => {
    expect(ProductResponse.safeParse({ id: "x" }).success).toBe(false);
  });
});
