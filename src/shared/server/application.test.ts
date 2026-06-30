/**
 * Unit tests for the shared `Application` orchestrator. We mock `Bun.serve`,
 * the DI container's DB/valkey/tracer registrations, and the Hono app so the
 * lifecycle (`start`, `stop`, re-entrancy, error handling) can be exercised
 * without binding a port or connecting to real services.
 */
import type { Hono } from "hono";
import type pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/db.ts";
import { type ValkeyClient, ValkeyKey } from "../../infrastructure/messaging/valkey.ts";
import {
  type HealthRegistry,
  HealthRegistryKey,
  LoggerKey,
  type TracerHandle,
  TracerKey,
} from "../telemetry/index.ts";

const { serveMock, buildAppMock, stopFn } = vi.hoisted(() => {
  const stopFn = vi.fn();
  let pending = 0;
  const serveMock = vi.fn(() => ({
    hostname: "127.0.0.1",
    port: 9999,
    stop: stopFn,
    get pendingRequests() {
      return pending;
    },
    __setPending(n: number) {
      pending = n;
    },
  }));
  const buildAppMock = vi.fn(
    () =>
      ({
        fetch: vi.fn(),
      }) as unknown as Hono,
  );
  return { serveMock, buildAppMock, stopFn };
});

vi.mock("../server/http.ts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../server/http.ts")>();
  return { ...mod, buildApp: buildAppMock };
});

const originalBun = (globalThis as { Bun?: unknown }).Bun;

function makeConfig(): Config {
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
    example: { enabled: false, default_page_size: 1, max_page_size: 1, max_name_length: 1 },
  } as Config;
}

function makeContainer(cfg = makeConfig()): {
  container: Container;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
} {
  const container = new Container();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  container.registerValue(ConfigKey, cfg);
  container.registerValue(LoggerKey, logger as unknown as pino.Logger);
  container.registerValue(HealthRegistryKey, {} as HealthRegistry);
  return { container, logger };
}

beforeEach(() => {
  serveMock.mockClear();
  buildAppMock.mockClear();
  stopFn.mockClear();
  (globalThis as { Bun: unknown }).Bun = { serve: serveMock };
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalBun === undefined) {
    delete (globalThis as { Bun?: unknown }).Bun;
  } else {
    (globalThis as { Bun?: unknown }).Bun = originalBun;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Application", () => {
  it("registers dependencies and starts Bun.serve on start()", async () => {
    const { Application } = await import("./application.ts");
    const { container } = makeContainer();
    const app = new Application(container);
    await app.start();
    expect(serveMock).toHaveBeenCalledTimes(1);
    expect(app.addr).toEqual({ hostname: "127.0.0.1", port: 9999 });
  });

  it("addr returns undefined when the server is not started", async () => {
    const { Application } = await import("./application.ts");
    const { container } = makeContainer();
    const app = new Application(container);
    expect(app.addr).toBeUndefined();
  });

  it("stop() shuts down db, valkey, and tracer when registered", async () => {
    const { Application } = await import("./application.ts");
    const { container } = makeContainer();
    const dbEnd = vi.fn().mockResolvedValue(undefined);
    const valkeyQuit = vi.fn().mockResolvedValue("OK");
    const tracerShutdown = vi.fn().mockResolvedValue(undefined);
    container.registerValue(DBKey, { end: dbEnd } as unknown as DBHandle);
    container.registerValue(ValkeyKey, { quit: valkeyQuit } as unknown as ValkeyClient);
    container.registerValue(TracerKey, { shutdown: tracerShutdown } as TracerHandle);
    const app = new Application(container);
    await app.start();
    await app.stop();
    expect(dbEnd).toHaveBeenCalledTimes(1);
    expect(valkeyQuit).toHaveBeenCalledTimes(1);
    expect(tracerShutdown).toHaveBeenCalledTimes(1);
  });

  it("stop() tolerates missing db/valkey/tracer registrations", async () => {
    const { Application } = await import("./application.ts");
    const { container } = makeContainer();
    const app = new Application(container);
    await app.start();
    await expect(app.stop()).resolves.toBeUndefined();
  });

  it("stop() logs and continues when a dependency close fails", async () => {
    const { Application } = await import("./application.ts");
    const { container, logger } = makeContainer();
    container.registerValue(DBKey, {
      end: vi.fn().mockRejectedValue(new Error("db close boom")),
    } as unknown as DBHandle);
    container.registerValue(ValkeyKey, {
      quit: vi.fn().mockRejectedValue(new Error("vk close boom")),
    } as unknown as ValkeyClient);
    container.registerValue(TracerKey, {
      shutdown: vi.fn().mockRejectedValue(new Error("tracer close boom")),
    } as TracerHandle);
    const app = new Application(container);
    await app.start();
    await app.stop();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({}), "db close error");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({}), "valkey close error");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({}), "tracer shutdown error");
  });

  it("stop() called without start() is a no-op for the server", async () => {
    const { Application } = await import("./application.ts");
    const { container } = makeContainer();
    const app = new Application(container);
    await expect(app.stop()).resolves.toBeUndefined();
    expect(serveMock).not.toHaveBeenCalled();
  });
});
