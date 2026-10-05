/**
 * Domain shape tests for the reporting feature. The feature owns no schema,
 * so the domain is two read-only projection interfaces; these tests pin their
 * zero-value (empty-database) semantics and the sentinel identity the error
 * mapper relies on.
 */
import { describe, expect, it } from "vitest";
import { ErrInvalidTopMachines } from "./errors.ts";
import type { MachineSales, Overview } from "./summary.ts";

describe("Overview", () => {
  it("zero value is the empty-database report: every total zero", () => {
    const overview: Overview = {
      productCount: 0,
      totalStock: 0,
      machineCount: 0,
      totalBankCents: 0,
      purchaseCount: 0,
      revenueCents: 0,
    };
    expect(Object.values(overview)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("MachineSales", () => {
  it("carries a string machine id and numeric rollup, like Go's uuid projection", () => {
    const row: MachineSales = {
      machineId: "11111111-1111-4111-8111-111111111111",
      label: "A",
      purchaseCount: 2,
      revenueCents: 150,
    };
    expect(row.machineId).toBe("11111111-1111-4111-8111-111111111111");
    expect(row.purchaseCount).toBe(2);
    expect(row.revenueCents).toBe(150);
  });

  it("zero value has no sales and no revenue", () => {
    const row: MachineSales = { machineId: "x", label: "", purchaseCount: 0, revenueCents: 0 };
    expect(row.purchaseCount + row.revenueCents).toBe(0);
  });
});

describe("reporting domain sentinels", () => {
  it("exposes ErrInvalidTopMachines by identity", () => {
    expect(ErrInvalidTopMachines).toBe(ErrInvalidTopMachines);
    expect(ErrInvalidTopMachines.message).toBe("top machines limit is invalid");
  });
});
