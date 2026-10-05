/**
 * Live-Postgres integration suite for the sales feature's repository,
 * mirroring the Go template's `repository_integration_test.go`. Sales reads and
 * writes the catalog and machines tables through its own projections, so the
 * suite seeds all three tables and resets them together. The repository owns one
 * cross-table transaction (`commitPurchase`): a purchase decrements stock,
 * replaces the machine's coin bank, and inserts the record atomically. There is
 * no env-based skip - an unreachable database fails the run.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DBHandle } from "../../../../infrastructure/db/index.ts";
import { newIntegrationDB, truncateTables } from "../../../../testutil/db.ts";
import { catalogProducts } from "../../../catalog/repository/postgres/schema.ts";
import { bankToJson, machines } from "../../../machines/repository/postgres/schema.ts";
import { ErrMachineNotFound, ErrOutOfStock, ErrProductNotFound } from "../../domain/errors.ts";
import type { PurchaseRecord } from "../../domain/purchase.ts";
import { DrizzleSalesRepository } from "./repository.ts";
import { salesPurchases } from "./schema.ts";

const FIXTURE_TIME = new Date("2026-01-01T00:00:00.000Z");
const MISSING_ID = "00000000-0000-4000-8000-000000000099";

describe("DrizzleSalesRepository (integration)", () => {
  let handle: DBHandle;
  let repo: DrizzleSalesRepository;

  beforeAll(async () => {
    handle = await newIntegrationDB();
    repo = new DrizzleSalesRepository(handle.db);
  });

  afterAll(async () => {
    await handle.end();
  });

  beforeEach(async () => {
    await truncateTables(handle.db, "sales_purchases", "machines", "catalog_products");
  });

  async function seedProduct(id: string, priceCents: number, stock: number): Promise<void> {
    await handle.db.insert(catalogProducts).values({
      id,
      name: "seed",
      priceCents,
      stock,
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    });
  }

  async function seedMachine(id: string, coinBank: Record<number, number>): Promise<void> {
    await handle.db.insert(machines).values({
      id,
      label: "seed",
      coinBank: bankToJson(coinBank),
      createdAt: FIXTURE_TIME,
      updatedAt: FIXTURE_TIME,
    });
  }

  async function purchaseRows(): Promise<{ id: string }[]> {
    return handle.db.select({ id: salesPurchases.id }).from(salesPurchases);
  }

  function fixedRecord(machineId: string, productId: string): PurchaseRecord {
    return {
      id: "33333333-3333-4333-8333-333333333333",
      machineId,
      productId,
      priceCents: 100,
      totalInsertedCents: 125,
      changeCents: 25,
      changeCoins: [25],
      purchasedAt: FIXTURE_TIME,
    };
  }

  it("getProduct maps the seeded row", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    await seedProduct(productId, 150, 3);

    const got = await repo.getProduct(productId);

    expect(got).toEqual({ productId, priceCents: 150, stock: 3 });
  });

  it("getProduct throws ErrProductNotFound for a missing row", async () => {
    await expect(repo.getProduct(MISSING_ID)).rejects.toBe(ErrProductNotFound);
  });

  it("getMachineBank converts the string-keyed jsonb bank", async () => {
    const machineId = "22222222-2222-4222-8222-222222222222";
    await seedMachine(machineId, { "5": 10, "25": 4 });

    const got = await repo.getMachineBank(machineId);

    expect(got).toEqual({ 5: 10, 25: 4 });
  });

  it("getMachineBank throws ErrMachineNotFound for a missing row", async () => {
    await expect(repo.getMachineBank(MISSING_ID)).rejects.toBe(ErrMachineNotFound);
  });

  it("commitPurchase decrements stock, replaces the bank, and inserts the record", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    const machineId = "22222222-2222-4222-8222-222222222222";
    await seedProduct(productId, 100, 4);
    await seedMachine(machineId, { "5": 10, "25": 10 });
    const record = fixedRecord(machineId, productId);

    await repo.commitPurchase(machineId, productId, record, { 5: 10, 25: 11 });

    expect((await repo.getProduct(productId)).stock).toBe(3);
    expect(await repo.getMachineBank(machineId)).toEqual({ 5: 10, 25: 11 });
    expect(await purchaseRows()).toEqual([{ id: record.id }]);
  });

  it("commitPurchase maps losing the stock race to ErrOutOfStock and keeps the purchase atomic", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    const machineId = "22222222-2222-4222-8222-222222222222";
    await seedProduct(productId, 100, 1);
    await seedMachine(machineId, { "5": 10 });

    const first = fixedRecord(machineId, productId);
    await repo.commitPurchase(machineId, productId, first, { 5: 11 });

    const second = {
      ...fixedRecord(machineId, productId),
      id: "44444444-4444-4444-8444-444444444444",
    };
    await expect(repo.commitPurchase(machineId, productId, second, { 5: 11 })).rejects.toBe(
      ErrOutOfStock,
    );

    expect((await repo.getProduct(productId)).stock).toBe(0);
    expect(await purchaseRows()).toEqual([{ id: first.id }]);
  });

  it("commitPurchase rolls the whole transaction back when the machine is missing", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    await seedProduct(productId, 100, 1);
    const record = fixedRecord(MISSING_ID, productId);

    await expect(repo.commitPurchase(MISSING_ID, productId, record, { 5: 11 })).rejects.toBe(
      ErrMachineNotFound,
    );

    expect((await repo.getProduct(productId)).stock).toBe(1);
    expect(await purchaseRows()).toEqual([]);
  });

  it("commitPurchase throws ErrProductNotFound when the product is missing", async () => {
    const machineId = "22222222-2222-4222-8222-222222222222";
    await seedMachine(machineId, { "5": 10 });
    const record = fixedRecord(machineId, MISSING_ID);

    await expect(repo.commitPurchase(machineId, MISSING_ID, record, { 5: 11 })).rejects.toBe(
      ErrProductNotFound,
    );
    expect(await purchaseRows()).toEqual([]);
  });
});
