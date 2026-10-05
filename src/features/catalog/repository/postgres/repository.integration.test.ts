/**
 * Live-Postgres integration suite for the catalog feature's repository,
 * mirroring the Go template's `repository_integration_test.go`: the harness
 * loads env-bound config, connects to real infrastructure, applies every
 * feature's migrations from one merged source, and truncates the feature's
 * table before each case. There is no env-based skip - an unreachable database
 * fails the run.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DBHandle } from "../../../../infrastructure/db/index.ts";
import { newIntegrationDB, truncateTables } from "../../../../testutil/db.ts";
import { FIXED_PRODUCT_ID, newProduct } from "../../../../testutil/fixtures/products.ts";
import { ErrProductNotFound } from "../../domain/errors.ts";
import { DrizzleProductRepository } from "./repository.ts";

const MISSING_ID = "00000000-0000-4000-8000-000000000099";

describe("DrizzleProductRepository (integration)", () => {
  let handle: DBHandle;
  let repo: DrizzleProductRepository;

  beforeAll(async () => {
    handle = await newIntegrationDB();
    repo = new DrizzleProductRepository(handle.db);
  });

  afterAll(async () => {
    await handle.end();
  });

  beforeEach(async () => {
    await truncateTables(handle.db, "catalog_products");
  });

  it("create then getById round-trips the product", async () => {
    const product = newProduct("integration-cola", 150, 4);
    await repo.create(product);

    const got = await repo.getById(FIXED_PRODUCT_ID);

    expect(got).toEqual(product);
  });

  it("getById throws ErrProductNotFound for a missing row", async () => {
    await expect(repo.getById(MISSING_ID)).rejects.toBe(ErrProductNotFound);
  });

  it("list returns the seeded rows ordered newest-first with limit applied", async () => {
    await repo.create(newProduct("alpha", 100, 1, "11111111-1111-4111-8111-111111111111"));
    await repo.create(newProduct("beta", 200, 2, "22222222-2222-4222-8222-222222222222"));
    await repo.create(newProduct("gamma", 300, 3, "33333333-3333-4333-8333-333333333333"));

    // Fixed timestamps are equal, so the repository falls back to id descending.
    const page = await repo.list(2, 0);

    expect(page.map((p) => p.name)).toEqual(["gamma", "beta"]);
  });
});
