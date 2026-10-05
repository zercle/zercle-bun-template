/**
 * Unit tests for the reporting feature's repository. A fake Drizzle DB
 * scripts `execute()` results and records each query, so we can assert the
 * two statements, the parameterized limit, bigint/numeric string coercion, and
 * cause-wrapped errors without touching a real database.
 */
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { DrizzleReportingRepository } from "./repository.ts";

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";
const dialect = new PgDialect();

interface Executed {
  text: string;
  params: unknown[];
}

/** Fake DB: records every `execute()` query and returns scripted results in order. */
function makeFakeDb(results: unknown[][]): { db: unknown; executed: Executed[] } {
  const executed: Executed[] = [];
  let idx = 0;
  const db = {
    execute: vi.fn((query: unknown) => {
      const built = dialect.sqlToQuery(query as never);
      executed.push({ text: built.sql, params: built.params });
      const rows = results[idx++] ?? [];
      return Promise.resolve(rows);
    }),
  };
  return { db, executed };
}

describe("DrizzleReportingRepository", () => {
  it("getOverview issues one statement and coerces string aggregates to numbers", async () => {
    const { db, executed } = makeFakeDb([
      [
        {
          product_count: "2",
          total_stock: "9",
          machine_count: "1",
          total_bank_cents: "125",
          purchase_count: "3",
          revenue_cents: "300",
        },
      ],
    ]);
    const repo = new DrizzleReportingRepository(db as never);

    const overview = await repo.getOverview();

    expect(overview).toEqual({
      productCount: 2,
      totalStock: 9,
      machineCount: 1,
      totalBankCents: 125,
      purchaseCount: 3,
      revenueCents: 300,
    });
    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("jsonb_each_text");
    expect(executed[0]?.text).toContain("catalog_products");
    expect(executed[0]?.text).toContain("sales_purchases");
    expect(executed[0]?.params).toEqual([]);
  });

  it("getOverview returns the zero-value report when no row comes back", async () => {
    const { db } = makeFakeDb([[]]);
    const repo = new DrizzleReportingRepository(db as never);

    const overview = await repo.getOverview();

    expect(overview).toEqual({
      productCount: 0,
      totalStock: 0,
      machineCount: 0,
      totalBankCents: 0,
      purchaseCount: 0,
      revenueCents: 0,
    });
  });

  it("getTopMachines parameterizes the limit and coerces the rollup", async () => {
    const { db, executed } = makeFakeDb([
      [{ machine_id: MACHINE_ID, label: "A", purchase_count: "3", revenue_cents: "300" }],
    ]);
    const repo = new DrizzleReportingRepository(db as never);

    const machines = await repo.getTopMachines(7);

    expect(machines).toEqual([
      { machineId: MACHINE_ID, label: "A", purchaseCount: 3, revenueCents: 300 },
    ]);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("LIMIT");
    expect(executed[0]?.params).toEqual([7]);
  });

  it("getTopMachines returns an empty array when no machine has sales", async () => {
    const { db } = makeFakeDb([[]]);
    const repo = new DrizzleReportingRepository(db as never);

    await expect(repo.getTopMachines(5)).resolves.toEqual([]);
  });

  it("getOverview wraps a driver failure with a cause", async () => {
    const boom = new Error("db down");
    const db = { execute: vi.fn(() => Promise.reject(boom)) };
    const repo = new DrizzleReportingRepository(db as never);

    const err = await repo.getOverview().then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(err?.message).toBe("get overview");
    expect(err?.cause).toBe(boom);
  });

  it("getTopMachines wraps a driver failure with a cause", async () => {
    const boom = new Error("db down");
    const db = { execute: vi.fn(() => Promise.reject(boom)) };
    const repo = new DrizzleReportingRepository(db as never);

    const err = await repo.getTopMachines(5).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(err?.message).toBe("get top machines");
    expect(err?.cause).toBe(boom);
  });
});
