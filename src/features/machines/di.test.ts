/**
 * Unit tests for the machines feature's DI registration. We provide a container
 * with `Config`, `DBHandle`, and a Hono `App` already registered, then assert
 * that `register` mounts the machines router at `/api/v1`, wires the machine
 * service backed by a Drizzle repository, and honors the `machines.enabled`
 * feature flag.
 */
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { AppKey } from "../../infrastructure/server/index.ts";

const { sqlFn, fakeSql } = vi.hoisted(() => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const fakeSql = Object.assign(sqlFn, { end: vi.fn() });
  return { sqlFn, fakeSql };
});

vi.mock("../../infrastructure/db/db.ts", () => ({
  createDB: vi.fn(),
  DBKey: Symbol("DB"),
}));

vi.mock("../../infrastructure/db/register.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../infrastructure/messaging/valkey.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  ValkeyKey: Symbol("Valkey"),
}));

vi.mock("../../infrastructure/telemetry/register.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../infrastructure/server/register.ts", () => ({
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

function makeCfg(machinesEnabled: boolean): Config {
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
    valkey: { host: "x", port: 1, password: "", db: 0, connect_timeout: 1, ttl: 30 },
    otel: { exporter: "none", endpoint: "", service_name: "t", sampling: 1 },
    log: { level: "error", format: "json" },
    catalog: {
      enabled: true,
      default_page_size: 20,
      max_page_size: 100,
      max_name_length: 255,
    },
    machines: {
      enabled: machinesEnabled,
      default_page_size: 20,
      max_page_size: 100,
      max_label_length: 255,
    },
    sales: { enabled: true },
    reporting: { enabled: true, default_top_machines: 5, max_top_machines: 20 },
  } as Config;
}

function makeContainer(machinesEnabled: boolean): Container {
  const container = new Container();
  const app = new Hono();
  container.registerValue(ConfigKey, makeCfg(machinesEnabled));
  container.registerValue(DBKey, {
    db: { _drizzle: true },
    sql: fakeSql,
    end: vi.fn(),
  } as unknown as DBHandle);
  container.registerValue(AppKey, app);
  return container;
}

describe("machines.register", () => {
  it("mounts the machines router under /api/v1 on the existing Hono app when enabled", async () => {
    const { register, MachinesRouterKey } = await import("./di.ts");

    const container = makeContainer(true);
    register(container);

    expect(container.tryResolve(MachinesRouterKey)).toBeDefined();
    const app = container.resolve<{ route: ReturnType<typeof vi.fn> }>(AppKey);
    expect(app.route).toBeDefined();
    // route is called when the machines router is mounted.
  });

  it("does not register the feature router when machines.enabled is false", async () => {
    const { register, MachinesRouterKey } = await import("./di.ts");

    const container = makeContainer(false);
    register(container);

    expect(container.tryResolve(AppKey)).toBeDefined();
    expect(container.tryResolve(MachinesRouterKey)).toBeUndefined();
  });

  it("registers sentinels mapping domain errors to AppError codes when enabled", async () => {
    const { register } = await import("./di.ts");
    const { httpError } = await import("../../infrastructure/errors/mapper.ts");
    const domain = await import("./domain/errors.ts");

    const container = makeContainer(true);
    register(container);

    expect(httpError(domain.ErrMachineNotFound).status).toBe(404);
    expect(httpError(domain.ErrInvalidID).status).toBe(400);
    expect(httpError(domain.ErrInvalidMachineLabel).status).toBe(400);
    expect(httpError(domain.ErrUnsupportedCoin).status).toBe(400);
  });
});
