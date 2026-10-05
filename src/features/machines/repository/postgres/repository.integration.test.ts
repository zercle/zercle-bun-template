/**
 * Live-Postgres integration suite for the machines feature's repository,
 * mirroring the Go template's `repository_integration_test.go`. It covers the
 * entity round-trip plus the transaction the repository owns: `restockBank`
 * locks the row FOR UPDATE and writes the combined bank. There is no env-based
 * skip - an unreachable database fails the run.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DBHandle } from "../../../../infrastructure/db/index.ts";
import { newIntegrationDB, truncateTables } from "../../../../testutil/db.ts";
import { FIXED_MACHINE_ID, newMachine } from "../../../../testutil/fixtures/machines.ts";
import { ErrMachineNotFound } from "../../domain/errors.ts";
import { DrizzleMachineRepository } from "./repository.ts";

const MISSING_ID = "00000000-0000-4000-8000-000000000099";

describe("DrizzleMachineRepository (integration)", () => {
  let handle: DBHandle;
  let repo: DrizzleMachineRepository;

  beforeAll(async () => {
    handle = await newIntegrationDB();
    repo = new DrizzleMachineRepository(handle.db);
  });

  afterAll(async () => {
    await handle.end();
  });

  beforeEach(async () => {
    await truncateTables(handle.db, "machines");
  });

  it("create then getById round-trips the machine and its coin bank", async () => {
    const machine = newMachine("integration-lobby", { 5: 3, 25: 2 });
    await repo.create(machine);

    const got = await repo.getById(FIXED_MACHINE_ID);

    expect(got).toEqual(machine);
  });

  it("getById throws ErrMachineNotFound for a missing row", async () => {
    await expect(repo.getById(MISSING_ID)).rejects.toBe(ErrMachineNotFound);
  });

  it("list returns the seeded rows ordered newest-first", async () => {
    await repo.create(newMachine("alpha", { 5: 1 }, "11111111-1111-4111-8111-111111111111"));
    await repo.create(newMachine("beta", { 5: 2 }, "22222222-2222-4222-8222-222222222222"));
    await repo.create(newMachine("gamma", { 5: 3 }, "33333333-3333-4333-8333-333333333333"));

    const page = await repo.list(10, 0);

    expect(page.map((m) => m.label)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("restockBank adds the coins to the persisted bank", async () => {
    await repo.create(newMachine("restock-lobby", { 5: 1, 25: 2 }));

    await repo.restockBank(FIXED_MACHINE_ID, [5, 100]);

    const got = await repo.getById(FIXED_MACHINE_ID);
    expect(got.coinBank).toEqual({ 5: 2, 25: 2, 100: 1 });
  });

  it("restockBank throws ErrMachineNotFound for a missing row", async () => {
    await expect(repo.restockBank(MISSING_ID, [5])).rejects.toBe(ErrMachineNotFound);
  });
});
