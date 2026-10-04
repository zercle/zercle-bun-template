/**
 * Cache-aside (stampede-safe) helper over a Redis-compatible client.
 *
 * Mirrors the Go template's `valkeyaside`-based `NewCacheAside`
 * (`internal/infrastructure/valkey/client.go`): on a cache miss the loader runs
 * once while concurrent misses for the same key wait on the same in-flight
 * promise, and the result is stored under `SET key value EX ttl`. A loader
 * error propagates to every waiter and is *not* cached, so the next `get`
 * re-invokes the loader.
 *
 * Go relies on server-side client tracking to invalidate entries on write; a
 * plain Redis connection has no such channel, so invalidation is explicit via
 * {@link CacheAside.del}.
 */

/** Symbol used to register the cache-aside facade in the DI container. */
export const CacheAsideKey = Symbol("CacheAside");

/**
 * Minimal Redis-shaped surface the cache-aside store needs. The concrete
 * ioredis client satisfies it structurally; tests pass a small fake.
 */
export interface CacheAsideRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, secondsToken: "EX", seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** Single-flight cache-aside facade. */
export class CacheAside {
  private readonly redis: CacheAsideRedis;
  private readonly ttlSeconds: number;
  /** In-flight loader promises, keyed by cache key. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(redis: CacheAsideRedis, ttlSeconds: number) {
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Return the cached value for `key`, or run `loader` on a miss and store its
   * JSON-serialized result for `ttlSeconds`. Concurrent misses for the same key
   * share one loader invocation; a rejected loader is not cached.
   */
  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const existing = this.inFlight.get(key);
    if (existing !== undefined) {
      return existing as Promise<T>;
    }

    const promise = (async (): Promise<T> => {
      try {
        const value = await loader();
        await this.redis.set(key, JSON.stringify(value), "EX", this.ttlSeconds);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  /** Remove `key` from the cache (invalidation on write). */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
