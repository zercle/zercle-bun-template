import { describe, expect, it } from "vitest";
import type { Config } from "../../config/config";
import { type Checker, HealthRegistry } from "./health";
import { createLogger } from "./logger";
import { startTracer } from "./tracer";

function makeConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    app: {
      name: "zercle-bun-template",
      environment: "test",
      host: "0.0.0.0",
      port: 8080,
      shutdown_timeout: 15,
    },
    http: {
      host: "0.0.0.0",
      port: 8080,
      read_timeout: 15,
      write_timeout: 15,
      idle_timeout: 60,
      body_limit: "1M",
      health_probe_timeout: 5,
      cors_allow_origins: [],
      cors_allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      cors_allow_headers: ["Authorization", "Content-Type", "X-Request-ID"],
    },
    db: {
      host: "localhost",
      port: 5432,
      name: "app",
      user: "app",
      password: "",
      ssl_mode: "disable",
      max_conns: 10,
      min_conns: 2,
      max_conn_idle: 1800,
      max_conn_life: 3600,
      connect_timeout: 5,
    },
    valkey: { host: "localhost", port: 6379, password: "", db: 0, connect_timeout: 5 },
    otel: { exporter: "none", endpoint: "", service_name: "zercle-bun-template", sampling: 1.0 },
    log: { level: "info", format: "json" },
    example: { enabled: false, default_page_size: 20, max_page_size: 100, max_name_length: 255 },
  };
  return { ...base, ...overrides };
}

describe("createLogger", () => {
  it("returns a pino logger with the configured level", () => {
    const logger = createLogger(makeConfig({ log: { level: "warn", format: "json" } }));
    expect(logger.level).toBe("warn");
  });

  it("honors the debug level", () => {
    const logger = createLogger(makeConfig({ log: { level: "debug", format: "json" } }));
    expect(logger.level).toBe("debug");
  });
});

describe("startTracer", () => {
  it("returns null when exporter is none", async () => {
    const handle = await startTracer(
      makeConfig({ otel: { exporter: "none", endpoint: "", service_name: "x", sampling: 1.0 } }),
    );
    expect(handle).toBeNull();
  });
});

describe("HealthRegistry", () => {
  it("live() resolves when empty", async () => {
    const reg = new HealthRegistry();
    await expect(reg.live()).resolves.toBeUndefined();
  });

  it("ready() resolves when empty", async () => {
    const reg = new HealthRegistry();
    await expect(reg.ready()).resolves.toBeUndefined();
  });

  it("ready() rejects with aggregated message when a checker fails", async () => {
    const reg = new HealthRegistry();
    const ok: Checker = { name: "ok", check: async () => {} };
    const bad: Checker = {
      name: "db",
      check: async () => Promise.reject(new Error("conn refused")),
    };
    reg.addReadiness(ok);
    reg.addReadiness(bad);
    await expect(reg.ready()).rejects.toThrow(/db: conn refused/);
  });

  it("aggregates messages from multiple failing checkers", async () => {
    const reg = new HealthRegistry();
    const slow: Checker = {
      name: "slow",
      check: () => new Promise<void>((resolve) => setTimeout(resolve, 10)),
    };
    const badA: Checker = {
      name: "alpha",
      check: async () => Promise.reject(new Error("alpha-down")),
    };
    const badB: Checker = {
      name: "beta",
      check: async () => Promise.reject(new Error("beta-down")),
    };
    reg.addReadiness(slow);
    reg.addReadiness(badA);
    reg.addReadiness(badB);
    await expect(reg.ready()).rejects.toThrow(/alpha: alpha-down/);
    await expect(reg.ready()).rejects.toThrow(/beta: beta-down/);
  });

  it("runs checkers concurrently (not serially)", async () => {
    const reg = new HealthRegistry();
    const t0 = Date.now();
    const slow: Checker = {
      name: "slow",
      check: () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
    };
    const fast: Checker = {
      name: "fast",
      check: () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
    };
    reg.addLiveness(slow);
    reg.addLiveness(fast);
    await reg.live();
    const elapsed = Date.now() - t0;
    // If serial, ~100ms; concurrent should be ~50ms. Allow generous slack.
    expect(elapsed).toBeLessThan(90);
  });
});
