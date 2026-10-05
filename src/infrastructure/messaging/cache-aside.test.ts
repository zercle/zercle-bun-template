import { describe, expect, it, vi } from "vitest";
import { CacheAside, CacheAsideKey, type CacheAsideRedis } from "./cache-aside";

function makeRedis(overrides: Partial<CacheAsideRedis> = {}): CacheAsideRedis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

describe("CacheAside", () => {
  it("returns the cached value without invoking the loader on a hit", async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify({ id: 1 })) });
    const cache = new CacheAside(redis, 30);
    const loader = vi.fn();

    const value = await cache.get("k", loader);

    expect(value).toEqual({ id: 1 });
    expect(loader).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenCalledWith("k");
  });

  it("runs the loader and stores JSON with SET key value EX ttl on a miss", async () => {
    const redis = makeRedis();
    const cache = new CacheAside(redis, 30);
    const loader = vi.fn().mockResolvedValue({ id: 7 });

    const value = await cache.get("k", loader);

    expect(value).toEqual({ id: 7 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith("k", JSON.stringify({ id: 7 }), "EX", 30);
  });

  it("runs the loader once for two concurrent misses (single-flight)", async () => {
    const redis = makeRedis();
    const cache = new CacheAside(redis, 30);
    let resolveLoader: ((v: string) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const a = cache.get("k", loader);
    const b = cache.get("k", loader);
    // Both calls await the initial cache read before reaching the loader.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loader).toHaveBeenCalledTimes(1);

    resolveLoader?.("done");
    await expect(Promise.all([a, b])).resolves.toEqual(["done", "done"]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it("does not cache a loader error and re-invokes the loader on the next get", async () => {
    const redis = makeRedis();
    const cache = new CacheAside(redis, 30);
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.get("k", loader)).rejects.toThrow("boom");
    expect(redis.set).not.toHaveBeenCalled();

    await expect(cache.get("k", loader)).resolves.toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("del removes the key", async () => {
    const redis = makeRedis();
    const cache = new CacheAside(redis, 30);

    await cache.del("k");

    expect(redis.del).toHaveBeenCalledWith("k");
  });

  it("returns CacheAsideKey symbol with description 'CacheAside'", () => {
    expect(CacheAsideKey.description).toBe("CacheAside");
  });
});
