/**
 * Unit tests for the catalog feature's cache-aside decorator. A small
 * in-memory fake stands in for the infrastructure `CacheAside` (JSON in, JSON out,
 * loader errors not stored), and a hand-written fake repository records calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CacheAside } from "../../../../infrastructure/messaging/cache-aside.ts";
import { ErrProductNotFound } from "../../domain/errors.ts";
import type { Product } from "../../domain/product.ts";
import type { ProductRepository } from "../repository.ts";
import { CachedProductRepository } from "./cached-repository.ts";

const PRODUCT_CACHE_PREFIX = "catalog:product:";

/**
 * In-memory stand-in mirroring the infrastructure CacheAside's observable contract:
 * a hit returns the JSON-parsed value, a miss runs the loader and stores the
 * JSON-serialized result, and a rejected loader stores nothing.
 */
class FakeCacheAside {
  readonly store = new Map<string, string>();
  readonly get = vi.fn(async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = this.store.get(key);
    if (hit !== undefined) {
      return JSON.parse(hit) as T;
    }
    const value = await loader();
    this.store.set(key, JSON.stringify(value));
    return value;
  });
  readonly del = vi.fn(async (key: string): Promise<void> => {
    this.store.delete(key);
  });
}

function makeRepo(): ProductRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
  };
}

function fixedProduct(name: string): Product {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    priceCents: 250,
    stock: 3,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  };
}

describe("CachedProductRepository", () => {
  let repo: ProductRepository;
  let aside: FakeCacheAside;
  let cached: CachedProductRepository;

  beforeEach(() => {
    repo = makeRepo();
    aside = new FakeCacheAside();
    cached = new CachedProductRepository(repo, aside as unknown as CacheAside);
  });

  it("getById on a miss goes through the aside with the namespaced key, then the repo", async () => {
    const product = fixedProduct("from-db");
    vi.mocked(repo.getById).mockResolvedValueOnce(product);

    const result = await cached.getById(product.id);

    expect(result).toEqual(product);
    expect(aside.get).toHaveBeenCalledOnce();
    expect(aside.get.mock.calls[0]?.[0]).toBe(PRODUCT_CACHE_PREFIX + product.id);
    expect(repo.getById).toHaveBeenCalledWith(product.id);
  });

  it("getById on a hit serves from the cache without touching the repo", async () => {
    const product = fixedProduct("from-cache");
    vi.mocked(repo.getById).mockResolvedValue(product);

    await cached.getById(product.id);
    const second = await cached.getById(product.id);

    expect(second).toEqual(product);
    expect(repo.getById).toHaveBeenCalledOnce();
  });

  it("does not cache a loader error: a missing product hits the repo on every call", async () => {
    vi.mocked(repo.getById).mockRejectedValue(ErrProductNotFound);

    await expect(cached.getById("missing")).rejects.toBe(ErrProductNotFound);
    await expect(cached.getById("missing")).rejects.toBe(ErrProductNotFound);

    expect(repo.getById).toHaveBeenCalledTimes(2);
  });

  it("create is a passthrough and never touches the cache", async () => {
    const product = fixedProduct("created");
    vi.mocked(repo.create).mockResolvedValueOnce(product);

    const result = await cached.create(product);

    expect(result).toEqual(product);
    expect(repo.create).toHaveBeenCalledWith(product);
    expect(aside.get).not.toHaveBeenCalled();
  });

  it("list is a passthrough and never touches the cache", async () => {
    const products = [fixedProduct("a"), fixedProduct("b")];
    vi.mocked(repo.list).mockResolvedValueOnce(products);

    const result = await cached.list(10, 20);

    expect(result).toEqual(products);
    expect(repo.list).toHaveBeenCalledWith(10, 20);
    expect(aside.get).not.toHaveBeenCalled();
  });
});
