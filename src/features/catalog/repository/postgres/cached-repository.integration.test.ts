/**
 * Live-Postgres + live-Valkey integration suite for the catalog feature's
 * cache-aside decorator, mirroring the Go template's
 * `cached_repository_integration_test.go`. A real `CacheAside` is built over an
 * ioredis client against the live Valkey, and the decorator wraps the real
 * Drizzle repository. The cache is flushed before each case so cases never share
 * cached entries. There is no env-based skip - unreachable infrastructure fails
 * the run.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DBHandle } from "../../../../infrastructure/db/index.ts";
import { CacheAside } from "../../../../infrastructure/messaging/cache-aside.ts";
import { createValkey, type ValkeyClient } from "../../../../infrastructure/messaging/valkey.ts";
import {
  loadIntegrationConfig,
  newIntegrationDB,
  truncateTables,
} from "../../../../testutil/db.ts";
import { FIXED_PRODUCT_ID, newProduct } from "../../../../testutil/fixtures/products.ts";
import { ErrProductNotFound } from "../../domain/errors.ts";
import { CachedProductRepository } from "./cached-repository.ts";
import { DrizzleProductRepository } from "./repository.ts";
import { catalogProducts } from "./schema.ts";

/** Matches `PRODUCT_CACHE_PREFIX` in `cached-repository.ts`; pins the key contract. */
const PRODUCT_CACHE_PREFIX = "catalog:product:";
const MISSING_ID = "00000000-0000-4000-8000-000000000099";

describe("CachedProductRepository (integration)", () => {
  let handle: DBHandle;
  let redis: ValkeyClient;
  let base: DrizzleProductRepository;
  let repo: CachedProductRepository;
  let aside: CacheAside;

  beforeAll(async () => {
    const cfg = loadIntegrationConfig();
    handle = await newIntegrationDB();
    redis = await createValkey(cfg);
    aside = new CacheAside(redis, cfg.valkey.ttl);
    base = new DrizzleProductRepository(handle.db);
    repo = new CachedProductRepository(base, aside);
  });

  afterAll(async () => {
    await redis.quit();
    await handle.end();
  });

  beforeEach(async () => {
    await truncateTables(handle.db, "catalog_products");
    await redis.flushdb();
  });

  async function deleteRow(id: string): Promise<void> {
    await handle.db.delete(catalogProducts).where(eq(catalogProducts.id, id));
  }

  it("serves the second read from the cache after the row is deleted", async () => {
    const product = newProduct("cache-aside", 200, 3);
    await base.create(product);

    const first = await repo.getById(FIXED_PRODUCT_ID);
    expect(first).toEqual(product);

    await deleteRow(FIXED_PRODUCT_ID);

    const second = await repo.getById(FIXED_PRODUCT_ID);
    expect(second).toEqual(product);
  });

  it("does not cache a missing product", async () => {
    await expect(repo.getById(MISSING_ID)).rejects.toBe(ErrProductNotFound);
    await expect(repo.getById(MISSING_ID)).rejects.toBe(ErrProductNotFound);
  });

  it("del invalidates a cached entry", async () => {
    const product = newProduct("invalidate", 100, 1);
    await base.create(product);

    await repo.getById(FIXED_PRODUCT_ID);
    await aside.del(PRODUCT_CACHE_PREFIX + FIXED_PRODUCT_ID);
    await deleteRow(FIXED_PRODUCT_ID);

    await expect(repo.getById(FIXED_PRODUCT_ID)).rejects.toBe(ErrProductNotFound);
  });

  it("does not cache list, which reads through to the database", async () => {
    await base.create(newProduct("listed", 100, 1));

    expect(await repo.list(10, 0)).toHaveLength(1);

    await deleteRow(FIXED_PRODUCT_ID);

    expect(await repo.list(10, 0)).toEqual([]);
  });
});
