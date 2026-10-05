/**
 * Contract tests: the wire schemas in `contract/` are the published inbound
 * API surface, so their accept/reject behavior is pinned here.
 */
import { describe, expect, it } from "vitest";
import {
  CatalogStats,
  MachineSales,
  MachineStats,
  SalesStats,
  SummaryRequest,
  SummaryResponse,
} from "./summary.ts";

describe("SummaryRequest", () => {
  it("accepts an absent top, zero, and positive integers", () => {
    expect(SummaryRequest.safeParse({}).success).toBe(true);
    expect(SummaryRequest.safeParse({ top: 0 }).success).toBe(true);
    expect(SummaryRequest.safeParse({ top: 5 }).success).toBe(true);
  });

  it("rejects a negative top", () => {
    expect(SummaryRequest.safeParse({ top: -1 }).success).toBe(false);
  });

  it("rejects a non-integer top", () => {
    expect(SummaryRequest.safeParse({ top: 1.5 }).success).toBe(false);
    expect(SummaryRequest.safeParse({ top: "5" }).success).toBe(false);
  });
});

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";

describe("SummaryResponse", () => {
  it("parses a wire-shaped payload", () => {
    const parsed = SummaryResponse.safeParse({
      catalog: { product_count: 2, total_stock: 9 },
      machines: { machine_count: 1, total_coin_bank_cents: 125 },
      sales: { purchase_count: 3, revenue_cents: 300 },
      top_machines: [{ machine_id: MACHINE_ID, label: "A", purchase_count: 3, revenue_cents: 300 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty top_machines array", () => {
    const parsed = SummaryResponse.safeParse({
      catalog: { product_count: 0, total_stock: 0 },
      machines: { machine_count: 0, total_coin_bank_cents: 0 },
      sales: { purchase_count: 0, revenue_cents: 0 },
      top_machines: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects payloads missing fields", () => {
    expect(
      SummaryResponse.safeParse({ catalog: { product_count: 1, total_stock: 2 } }).success,
    ).toBe(false);
  });

  it("carries the documented wire field names", () => {
    expect(Object.keys(CatalogStats.shape)).toEqual(["product_count", "total_stock"]);
    expect(Object.keys(MachineStats.shape)).toEqual(["machine_count", "total_coin_bank_cents"]);
    expect(Object.keys(SalesStats.shape)).toEqual(["purchase_count", "revenue_cents"]);
    expect(Object.keys(MachineSales.shape)).toEqual([
      "machine_id",
      "label",
      "purchase_count",
      "revenue_cents",
    ]);
    expect(Object.keys(SummaryResponse.shape)).toEqual([
      "catalog",
      "machines",
      "sales",
      "top_machines",
    ]);
  });
});
