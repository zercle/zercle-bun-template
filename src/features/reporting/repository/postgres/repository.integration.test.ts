/**
 * Live-Postgres integration suite for the reporting feature's repository,
 * mirroring the Go template's `repository_integration_test.go`. Reporting owns
 * no schema and only reads; the suite seeds the catalog, machines, and sales
 * tables directly and resets all three before each case. There is no env-based
 * skip - an unreachable database fails the run.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DBHandle } from "../../../../infrastructure/db/index.ts";
import { newIntegrationDB, truncateTables } from "../../../../testutil/db.ts";
import { catalogProducts } from "../../../catalog/repository/postgres/schema.ts";
import { bankToJson, machines } from "../../../machines/repository/postgres/schema.ts";
import { salesPurchases } from "../../../sales/repository/postgres/schema.ts";
import { DrizzleReportingRepository } from "./repository.ts";

describe("DrizzleReportingRepository (integration)", () => {
  let handle: DBHandle;
  let repo: DrizzleReportingRepository;

  beforeAll(async () => {
    handle = await newIntegrationDB();
    repo = new DrizzleReportingRepository(handle.db);
  });

  afterAll(async () => {
    await handle.end();
  });

  beforeEach(async () => {
    await truncateTables(handle.db, "sales_purchases", "machines", "catalog_products");
  });

  async function seedProduct(stock: number): Promise<void> {
    await handle.db.insert(catalogProducts).values({
      id: randomUUID(),
      name: "seed",
      priceCents: 100,
      stock,
    });
  }

  async function seedMachine(id: string, bank: Record<number, number>): Promise<void> {
    await handle.db.insert(machines).values({ id, label: "seed", coinBank: bankToJson(bank) });
  }

  async function seedPurchase(machineId: string, priceCents: number): Promise<void> {
    await handle.db.insert(salesPurchases).values({
      id: randomUUID(),
      machineId,
      productId: randomUUID(),
      priceCents,
      totalInsertedCents: priceCents,
      changeCents: 0,
      changeCoins: [],
      purchasedAt: new Date(),
    });
  }

  it("getOverview returns a zero-value report on empty tables", async () => {
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

  it("getOverview aggregates the catalog, machines, and sales totals", async () => {
    await seedProduct(3);
    await seedProduct(5);

    const machineId = randomUUID();
    // 5*10 + 25*4 = 150 and 100*2 = 200, so the total bank is 350.
    await seedMachine(machineId, { 5: 10, 25: 4 });
    await seedMachine(randomUUID(), { 100: 2 });

    await seedPurchase(machineId, 100);
    await seedPurchase(machineId, 150);

    const overview = await repo.getOverview();

    expect(overview).toEqual({
      productCount: 2,
      totalStock: 8,
      machineCount: 2,
      totalBankCents: 350,
      purchaseCount: 2,
      revenueCents: 250,
    });
  });

  it("getTopMachines orders by revenue descending", async () => {
    const m1 = "11111111-1111-4111-8111-111111111111";
    const m2 = "22222222-2222-4222-8222-222222222222";
    await seedMachine(m1, {});
    await seedMachine(m2, {});

    await seedPurchase(m1, 100);
    await seedPurchase(m1, 100);
    await seedPurchase(m2, 500);

    const got = await repo.getTopMachines(10);

    expect(got).toEqual([
      { machineId: m2, label: "seed", purchaseCount: 1, revenueCents: 500 },
      { machineId: m1, label: "seed", purchaseCount: 2, revenueCents: 200 },
    ]);
  });

  it("getTopMachines breaks equal revenue and count ties by id ascending", async () => {
    const m1 = "11111111-1111-4111-8111-111111111111";
    const m2 = "22222222-2222-4222-8222-222222222222";
    await seedMachine(m1, {});
    await seedMachine(m2, {});

    await seedPurchase(m1, 100);
    await seedPurchase(m1, 100);
    await seedPurchase(m2, 100);
    await seedPurchase(m2, 100);

    const got = await repo.getTopMachines(10);

    expect(got.map((m) => m.machineId)).toEqual([m1, m2]);
  });

  it("getTopMachines excludes machines without sales", async () => {
    const seller = "11111111-1111-4111-8111-111111111111";
    const idle = "22222222-2222-4222-8222-222222222222";
    await seedMachine(seller, {});
    await seedMachine(idle, {});
    await seedPurchase(seller, 100);

    const got = await repo.getTopMachines(10);

    expect(got).toEqual([
      { machineId: seller, label: "seed", purchaseCount: 1, revenueCents: 100 },
    ]);
  });

  it("getTopMachines respects the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const machineId = randomUUID();
      await seedMachine(machineId, {});
      await seedPurchase(machineId, 100);
    }

    const got = await repo.getTopMachines(2);

    expect(got).toHaveLength(2);
  });
});
