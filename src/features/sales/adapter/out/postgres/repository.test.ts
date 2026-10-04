/**
 * Unit tests for the sales feature's repository. We supply a fake Drizzle DB
 * that scripts the results of each chained query so we can assert the
 * repository maps rows, guards the stock race, and rejects with the right
 * sentinel without touching a real database.
 */
import { describe, expect, it } from "vitest";
import { ErrMachineNotFound, ErrOutOfStock, ErrProductNotFound } from "../../../domain/errors.ts";
import type { PurchaseRecord } from "../../../domain/purchase.ts";
import { DrizzleSalesRepository } from "./repository.ts";

interface FakeRec {
  updateSets: unknown[];
  inserted: unknown[];
}

/**
 * A minimal fake exposing the Drizzle chains the repository uses: a select
 * chain ending in `.limit()` (thenable, also carrying `.for`), an update chain
 * ending in `.returning()`, an insert chain, and a pass-through transaction.
 */
function makeFakeDb(results: { selects?: unknown[][]; updates?: unknown[][] }): {
  db: unknown;
  rec: FakeRec;
} {
  const rec: FakeRec = { updateSets: [], inserted: [] };
  const selects = results.selects ?? [];
  const updates = results.updates ?? [];
  let selectIdx = 0;
  let updateIdx = 0;

  const makeSelect = (): unknown => {
    const limit = (): Promise<unknown[]> => {
      const rows = selects[selectIdx++] ?? [];
      const p = Promise.resolve(rows) as Promise<unknown[]> & {
        for: (strength: string) => Promise<unknown[]>;
      };
      p.for = () => Promise.resolve(rows);
      return p;
    };
    return { from: () => ({ where: () => ({ limit }) }) };
  };

  const makeUpdate = (): unknown => ({
    set: (values: unknown) => {
      rec.updateSets.push(values);
      return {
        where: () => ({ returning: () => Promise.resolve(updates[updateIdx++] ?? []) }),
      };
    },
  });

  const makeInsert = (): unknown => ({
    values: (values: unknown) => {
      rec.inserted.push(values);
      return Promise.resolve();
    },
  });

  const tx = { select: makeSelect, update: makeUpdate, insert: makeInsert };
  const db = {
    select: makeSelect,
    update: makeUpdate,
    insert: makeInsert,
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  };
  return { db, rec };
}

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

function fixedRecord(): PurchaseRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    machineId: MACHINE_ID,
    productId: PRODUCT_ID,
    priceCents: 100,
    totalInsertedCents: 125,
    changeCents: 25,
    changeCoins: [25],
    purchasedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

describe("DrizzleSalesRepository", () => {
  it("getProduct maps the row and returns it", async () => {
    const { db } = makeFakeDb({
      selects: [[{ productId: PRODUCT_ID, priceCents: 150, stock: 3 }]],
    });
    const repo = new DrizzleSalesRepository(db as never);
    const got = await repo.getProduct(PRODUCT_ID);
    expect(got).toEqual({ productId: PRODUCT_ID, priceCents: 150, stock: 3 });
  });

  it("getProduct throws ErrProductNotFound when no row matches", async () => {
    const { db } = makeFakeDb({ selects: [[]] });
    const repo = new DrizzleSalesRepository(db as never);
    await expect(repo.getProduct(PRODUCT_ID)).rejects.toBe(ErrProductNotFound);
  });

  it("getMachineBank converts string keys to a number-keyed bank", async () => {
    const { db } = makeFakeDb({ selects: [[{ coinBank: { "5": 10, "25": 4 } }]] });
    const repo = new DrizzleSalesRepository(db as never);
    const got = await repo.getMachineBank(MACHINE_ID);
    expect(got).toEqual({ 5: 10, 25: 4 });
  });

  it("getMachineBank throws ErrMachineNotFound when no row matches", async () => {
    const { db } = makeFakeDb({ selects: [[]] });
    const repo = new DrizzleSalesRepository(db as never);
    await expect(repo.getMachineBank(MACHINE_ID)).rejects.toBe(ErrMachineNotFound);
  });

  it("commitPurchase locks, decrements, replaces the bank, and inserts", async () => {
    const { db, rec } = makeFakeDb({
      selects: [[{ id: PRODUCT_ID }]],
      updates: [[{ id: PRODUCT_ID }], [{ id: MACHINE_ID }]],
    });
    const repo = new DrizzleSalesRepository(db as never);
    const record = fixedRecord();

    await repo.commitPurchase(MACHINE_ID, PRODUCT_ID, record, { 25: 11 });

    expect(rec.inserted).toHaveLength(1);
    expect(rec.inserted[0]).toEqual({
      id: record.id,
      machineId: MACHINE_ID,
      productId: PRODUCT_ID,
      priceCents: 100,
      totalInsertedCents: 125,
      changeCents: 25,
      changeCoins: [25],
      purchasedAt: record.purchasedAt,
    });
    // The coin bank is written with the jsonb column's string keys.
    expect(rec.updateSets[1]).toMatchObject({ coinBank: { "25": 11 } });
  });

  it("commitPurchase throws ErrProductNotFound when the lock finds nothing", async () => {
    const { db, rec } = makeFakeDb({ selects: [[]] });
    const repo = new DrizzleSalesRepository(db as never);
    await expect(
      repo.commitPurchase(MACHINE_ID, PRODUCT_ID, fixedRecord(), { 25: 11 }),
    ).rejects.toBe(ErrProductNotFound);
    expect(rec.inserted).toHaveLength(0);
    expect(rec.updateSets).toHaveLength(0);
  });

  it("commitPurchase throws ErrOutOfStock when the guarded decrement affects no row", async () => {
    const { db, rec } = makeFakeDb({ selects: [[{ id: PRODUCT_ID }]], updates: [[]] });
    const repo = new DrizzleSalesRepository(db as never);
    await expect(
      repo.commitPurchase(MACHINE_ID, PRODUCT_ID, fixedRecord(), { 25: 11 }),
    ).rejects.toBe(ErrOutOfStock);
    expect(rec.inserted).toHaveLength(0);
  });

  it("commitPurchase throws ErrMachineNotFound when the bank update affects no row", async () => {
    const { db, rec } = makeFakeDb({
      selects: [[{ id: PRODUCT_ID }]],
      updates: [[{ id: PRODUCT_ID }], []],
    });
    const repo = new DrizzleSalesRepository(db as never);
    await expect(
      repo.commitPurchase(MACHINE_ID, PRODUCT_ID, fixedRecord(), { 25: 11 }),
    ).rejects.toBe(ErrMachineNotFound);
    expect(rec.inserted).toHaveLength(0);
  });
});
