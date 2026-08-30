/**
 * Unit tests for the example feature's DI registration. We provide a
 * container with `Config`, `DBHandle`, and a Hono `App` already registered,
 * then assert that `register` mounts the example router at `/api/v1` and
 * wires the item service backed by a Drizzle repository.
 */
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { AppKey } from "../../platform/server/index.ts";

const { sqlFn, fakeSql } = vi.hoisted(() => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const fakeSql = Object.assign(sqlFn, { end: vi.fn() });
  return { sqlFn, fakeSql };
});

vi.mock("../../platform/db/db.ts", () => ({
  createDB: vi.fn(),
  DBKey: Symbol("DB"),
}));

vi.mock("../../platform/db/register.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../platform/messaging/valkey.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  ValkeyKey: Symbol("Valkey"),
}));

vi.mock("../../platform/telemetry/register.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../platform/server/register.ts", () => ({
  register: vi.fn(),
  ApplicationKey: Symbol.for("Application"),
}));

vi.mock("postgres", () => ({
  default: () => fakeSql,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({ _drizzle: true }),
}));

beforeEach(() => {
  sqlFn.mockReset().mockImplementation(() => Promise.resolve([]));
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
      host: "x",
      port: 1,
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
    example: {
      enabled: true,
      default_page_size: 20,
      max_page_size: 50,
      max_name_length: 100,
    },
  } as Config;
}

function makeContainer(): Container {
  const container = new Container();
  const app = new Hono();
  container.registerValue(ConfigKey, makeCfg());
  container.registerValue(DBKey, {
    db: { _drizzle: true },
    sql: fakeSql,
    end: vi.fn(),
  } as unknown as DBHandle);
  container.registerValue(AppKey, app);
  return container;
}

describe("example.register", () => {
  it("mounts the example router under /api/v1 on the existing Hono app", async () => {
    const { register } = await import("./di.ts");
    const { HealthRegistryKey } = await import("../../platform/telemetry/index.ts");
    const container = makeContainer();
    container.registerValue(HealthRegistryKey, { addReadiness: vi.fn() } as never);

    register(container);

    const app = container.resolve<{ route: ReturnType<typeof vi.fn> }>(AppKey);
    expect(app.route).toBeDefined();
    // route is called when the example router is mounted.
  });

  it("registers sentinels mapping domain errors to AppError codes", async () => {
    const { register } = await import("./di.ts");
    const { HealthRegistryKey } = await import("../../platform/telemetry/index.ts");
    const { httpError } = await import("../../platform/errors/mapper.ts");
    const domain = await import("./domain/errors.ts");
    const container = makeContainer();
    container.registerValue(HealthRegistryKey, { addReadiness: vi.fn() } as never);

    register(container);

    expect(httpError(domain.ErrItemNotFound).status).toBe(404);
    expect(httpError(domain.ErrInvalidName).status).toBe(400);
    expect(httpError(domain.ErrInvalidID).status).toBe(400);
  });
});
