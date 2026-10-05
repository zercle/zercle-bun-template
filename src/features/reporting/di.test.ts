/**
 * Unit tests for the reporting feature's DI registration. We provide a
 * container with `Config`, `DBHandle`, and a Hono `App` already registered,
 * then assert that `register` mounts the reporting router at `/api/v1`, maps
 * the sentinel, passes the configured bounds into the use case, and skips the
 * feature entirely when disabled.
 */
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { AppKey } from "../../infrastructure/server/index.ts";

const { sqlFn, fakeSql, ctorArgs } = vi.hoisted(() => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const fakeSql = Object.assign(sqlFn, { end: vi.fn() });
  return { sqlFn, fakeSql, ctorArgs: [] as unknown[][] };
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

vi.mock("./usecase/usecase.ts", () => ({
  ReportingUsecase: class {
    constructor(...args: unknown[]) {
      ctorArgs.push(args);
    }
    summary(): Promise<never> {
      return Promise.reject(new Error("not used"));
    }
  },
}));

beforeEach(() => {
  sqlFn.mockReset().mockImplementation(() => Promise.resolve([]));
  ctorArgs.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCfg(reportingEnabled: boolean, defaultTop = 5, maxTop = 20): Config {
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
      enabled: true,
      default_page_size: 20,
      max_page_size: 100,
      max_label_length: 255,
    },
    sales: { enabled: true },
    reporting: {
      enabled: reportingEnabled,
      default_top_machines: defaultTop,
      max_top_machines: maxTop,
    },
  } as Config;
}

function makeContainer(reportingEnabled: boolean, defaultTop = 5, maxTop = 20): Container {
  const container = new Container();
  const app = new Hono();
  container.registerValue(ConfigKey, makeCfg(reportingEnabled, defaultTop, maxTop));
  container.registerValue(DBKey, {
    db: { _drizzle: true },
    sql: fakeSql,
    end: vi.fn(),
  } as unknown as DBHandle);
  container.registerValue(AppKey, app);
  return container;
}

describe("reporting.register", () => {
  it("mounts the reporting router at /api/v1/reports/summary", async () => {
    const { register } = await import("./di.ts");
    const container = makeContainer(true);

    register(container);

    const app = container.resolve<Hono>(AppKey);
    expect(app.routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/v1/reports/summary" }),
    );
  });

  it("registers the sentinel mapping the domain error to INVALID_INPUT", async () => {
    const { register } = await import("./di.ts");
    const { httpError } = await import("../../infrastructure/errors/mapper.ts");
    const domain = await import("./domain/errors.ts");
    const container = makeContainer(true);

    register(container);

    expect(httpError(domain.ErrInvalidTopMachines).status).toBe(400);
  });

  it("passes the configured bounds into the use case", async () => {
    const { register } = await import("./di.ts");
    const container = makeContainer(true, 7, 9);

    register(container);

    expect(ctorArgs).toHaveLength(1);
    expect(ctorArgs[0]?.[1]).toBe(7);
    expect(ctorArgs[0]?.[2]).toBe(9);
  });

  it("registers nothing when the feature is disabled", async () => {
    const { register } = await import("./di.ts");
    const { ReportingRouterKey } = await import("./di.ts");
    const container = makeContainer(false);

    register(container);

    const app = container.resolve<Hono>(AppKey);
    expect(app.routes.some((r) => r.path === "/api/v1/reports/summary")).toBe(false);
    expect(container.tryResolve(ReportingRouterKey)).toBeUndefined();
    expect(ctorArgs).toHaveLength(0);
  });
});
