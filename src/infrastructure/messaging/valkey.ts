/**
 * Valkey (Redis-compatible) infrastructure wiring.
 *
 * Mirrors the Go template's `internal/infrastructure/messaging/valkey` package.
 * Constructs an ioredis client from `Config`, pings the server before returning
 * to fail fast on misconfiguration, and registers a readiness checker that
 * issues `PING` from the health probe path.
 */
import Redis from "ioredis";
import type { Container } from "../../app/container";
import { type Config, ConfigKey } from "../../config/config";
import {
  type Checker,
  type HealthRegistry,
  HealthRegistryKey,
} from "../../shared/telemetry/health";

/** Concrete ioredis client type used across the app. */
export type ValkeyClient = Redis;

/** Symbol used to register the Valkey client in the DI container. */
export const ValkeyKey = Symbol("Valkey");

/**
 * Build a connected ioredis client from `Config`.
 *
 * Connection strategy: ioredis connects eagerly by default, but a connect
 * failure would surface from a later command rather than `new Redis(...)`.
 * To fail fast (mirroring the Go template's `NewClient`, which pings before
 * returning) we set `lazyConnect: true`, explicitly call `connect()`, then
 * issue `PING`, and on any failure `disconnect()` to release sockets before
 * throwing. The caller owns the returned client and is responsible for
 * `quit()`/`disconnect()` at shutdown.
 */
export async function createValkey(cfg: Config): Promise<ValkeyClient> {
  const client = new Redis({
    host: cfg.valkey.host,
    port: cfg.valkey.port,
    password: cfg.valkey.password || undefined,
    db: cfg.valkey.db,
    connectTimeout: cfg.valkey.connect_timeout * 1000,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  try {
    await client.connect();
    await client.ping();
  } catch (err) {
    client.disconnect();
    throw new Error(
      `connect valkey ${cfg.valkey.host}:${cfg.valkey.port}: ${(err as Error).message}`,
      {
        cause: err,
      },
    );
  }

  return client;
}

/** Readiness checker: issues `PING` and rejects on any non-"PONG" reply. */
export function valkeyChecker(client: ValkeyClient): Checker {
  return {
    name: "valkey",
    check: async () => {
      const res = await client.ping();
      if (res !== "PONG") {
        throw new Error(`unexpected ping response: ${res}`);
      }
    },
  };
}

/**
 * Register the Valkey client + readiness checker in the container.
 *
 * Resolves `Config` and `HealthRegistry`, builds a connected client, and
 * exposes it under {@link ValkeyKey}. The checker is added to readiness
 * (not liveness) so a transient Valkey outage surfaces via `/readyz`
 * without restarting the process.
 */
export async function register(container: Container): Promise<void> {
  const cfg = container.resolve<Config>(ConfigKey);
  const client = await createValkey(cfg);
  container.registerValue(ValkeyKey, client);

  const registry = container.resolve<HealthRegistry>(HealthRegistryKey);
  registry.addReadiness(valkeyChecker(client));
}
