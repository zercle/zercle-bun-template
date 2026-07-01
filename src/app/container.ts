/**
 * Lightweight DI composition root.
 *
 * The Container is the single place where every layer/feature in this service
 * is wired together. It mirrors the Go template's `do.Injector` semantics
 * (samber/do) — in particular, eager singleton construction: a registered
 * factory is invoked exactly once at registration time, and the resulting
 * value is stored under the given key. Subsequent `resolve`/`get` calls return
 * the same instance.
 *
 * Each layer/feature exposes a `register(container)` function that pulls its
 * dependencies out of the container and registers its own services. The
 * composition root (`src/app/app.ts`) drives these in a fixed order:
 *
 *   1. config  (register the `Config` value first)
 *   2. telemetry (logger, tracer, meter, health registry)
 *   3. infrastructure (db, valkey — async)
 *   4. server (Hono app + Application)
 *   5. features (example)
 *
 * Keys are `Symbol("Name")` values exported from each module
 * (e.g. `export const ConfigKey = Symbol("Config")`).
 */
export class Container {
  private readonly registry = new Map<symbol, unknown>();

  /**
   * Register a service under `key`. The factory is invoked **immediately**
   * (eager singleton) and the resulting value is stored. Returns the value
   * so callers can capture it for synchronous chaining.
   */
  register<T>(key: symbol, factory: (c: Container) => T): T {
    const value = factory(this);
    this.registry.set(key, value);
    return value;
  }

  /** Store a pre-built value under `key` (e.g. the resolved `Config`). */
  registerValue<T>(key: symbol, value: T): void {
    this.registry.set(key, value);
  }

  /**
   * Resolve the value registered under `key`. Throws if the key has not been
   * registered — this is a fail-fast signal that registration order has been
   * violated.
   */
  resolve<T>(key: symbol): T {
    if (!this.registry.has(key)) {
      throw new Error(`dependency not registered: ${String(key.description ?? key)}`);
    }
    return this.registry.get(key) as T;
  }

  /** Resolve the value registered under `key`, or `undefined` if missing. */
  tryResolve<T>(key: symbol): T | undefined {
    return this.registry.get(key) as T | undefined;
  }

  /** Alias of {@link resolve} for call sites that read more naturally with `get`. */
  get<T>(key: symbol): T {
    return this.resolve<T>(key);
  }
}
