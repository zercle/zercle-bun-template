/**
 * Unit tests for the server layer's DI registration. We provide a container
 * with the minimum prerequisite registrations (`Config`, `Logger`,
 * `HealthRegistry`) and assert that `register` populates `App` (the Hono
 * instance) and `Application` (the orchestrator).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { HealthRegistry, HealthRegistryKey, LoggerKey } from "../telemetry/index.ts";

const originalBun = (globalThis as { Bun?: unknown }).Bun;
const serveMock = vi.fn(() => ({
  hostname: "127.0.0.1",
  port: 1234,
  stop: vi.fn().mockResolvedValue(undefined),
  stopTrue: vi.fn(),
}));

beforeEach(() => {
  serveMock.mockClear();
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
    example: { enabled: false, default_page_size: 1, max_page_size: 1, max_name_length: 1 },
  } as Config;
}

describe("server.register", () => {
  it("registers both the Hono app and the Application orchestrator", async () => {
    const { Application } = await import("./application.ts");
    const { AppKey, ApplicationKey, register } = await import("./index.ts");

    const container = new Container();
    container.registerValue(ConfigKey, makeCfg());
    container.registerValue(LoggerKey, {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });
    container.registerValue(HealthRegistryKey, new HealthRegistry());

    register(container);

    const app = container.resolve(AppKey);
    expect(app).toBeDefined();
    expect(typeof (app as { fetch?: unknown }).fetch).toBe("function");

    const orchestrator = container.resolve<InstanceType<typeof Application>>(ApplicationKey);
    expect(orchestrator).toBeInstanceOf(Application);
  });
});
