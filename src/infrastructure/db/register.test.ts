/**
 * Unit tests for the DB layer's DI registration. We mock the `postgres`
 * driver so `createDB` runs without touching the network, then exercise
 * `register` to assert that the DBHandle lands in the container and the
 * readiness checker is added to the HealthRegistry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { HealthRegistry, HealthRegistryKey } from "../../shared/telemetry/index.ts";

const { sqlFn, endFn, fakeSql } = vi.hoisted(() => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const endFn = vi.fn(() => Promise.resolve());
  const fakeSql = Object.assign(sqlFn, { end: endFn });
  return { sqlFn, endFn, fakeSql };
});

vi.mock("postgres", () => ({
  default: () => fakeSql,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({ _drizzle: true }),
}));

beforeEach(() => {
  sqlFn.mockReset().mockImplementation(() => Promise.resolve([]));
  endFn.mockReset().mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCfg(): Config {
  return {
    app: {
      name: "t",
      environment: "test",
      host: "127.0.0.1",
      port: 0,
      shutdown_timeout: 1,
    },
    http: {
      host: "127.0.0.1",
      port: 0,
      read_timeout: 1,
      write_timeout: 1,
      idle_timeout: 1,
      body_limit: "1M",
      health_probe_timeout: 1,
      cors_allow_origins: [],
      cors_allow_methods: ["GET"],
      cors_allow_headers: ["Authorization"],
    },
    db: {
      host: "localhost",
      port: 5432,
      name: "x",
      user: "x",
      password: "x",
      ssl_mode: "disable",
      max_conns: 1,
      min_conns: 0,
      max_conn_idle: 1,
      max_conn_life: 1,
      connect_timeout: 1,
    },
    valkey: { host: "x", port: 1, password: "", db: 0, connect_timeout: 1 },
    otel: { exporter: "none", endpoint: "", service_name: "t", sampling: 1 },
    log: { level: "error", format: "json" },
    example: { enabled: false, default_page_size: 1, max_page_size: 1, max_name_length: 1 },
  } as Config;
}

describe("db.register", () => {
  it("registers the DBHandle and adds a postgres readiness checker", async () => {
    const { DBKey } = await import("./db.ts");
    const { register } = await import("./register.ts");
    const container = new Container();
    const registry = new HealthRegistry();
    container.registerValue(ConfigKey, makeCfg());
    container.registerValue(HealthRegistryKey, registry);

    await register(container);

    const handle = container.resolve<{
      db: unknown;
      sql: typeof fakeSql;
      end: () => Promise<void>;
    }>(DBKey);
    expect(handle.db).toBeDefined();
    expect(handle.sql).toBe(fakeSql);
    await expect(registry.ready()).resolves.toBeUndefined();
  });

  it("propagates createDB failures as a rejected promise", async () => {
    const { register } = await import("./register.ts");
    const container = new Container();
    const registry = new HealthRegistry();
    container.registerValue(ConfigKey, makeCfg());
    container.registerValue(HealthRegistryKey, registry);

    sqlFn.mockImplementationOnce(() => Promise.reject(new Error("down")));

    await expect(register(container)).rejects.toThrow(/ping db/);
  });
});
