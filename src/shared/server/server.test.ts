/**
 * Unit tests for the shared Hono app: observability routes, error mapping,
 * and 404 fallthrough. Drives the Hono app directly via `app.request(...)`
 * — no real HTTP listener, no DB, no Valkey.
 */
import type { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { HealthRegistry, HealthRegistryKey, LoggerKey } from "../../shared/telemetry/index.ts";
import { buildApp } from "./http.ts";

function makeConfig(overrides: Partial<Config["http"]> = {}): Config {
  return {
    app: {
      name: "zercle-bun-template",
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
      cors_allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      cors_allow_headers: ["Authorization", "Content-Type", "X-Request-ID"],
      ...overrides,
    },
    db: {
      host: "localhost",
      port: 5432,
      name: "x",
      user: "x",
      password: "x",
      ssl_mode: "disable",
      max_conns: 10,
      min_conns: 2,
      max_conn_idle: 1800,
      max_conn_life: 3600,
      connect_timeout: 5,
    },
    valkey: {
      host: "localhost",
      port: 6379,
      password: "",
      db: 0,
      connect_timeout: 5,
    },
    otel: { exporter: "none", endpoint: "", service_name: "zercle-bun-template", sampling: 1 },
    log: { level: "error", format: "json" },
    example: { enabled: false, default_page_size: 20, max_page_size: 100, max_name_length: 255 },
  } as Config;
}

async function makeApp(
  cfgOverrides: Partial<Config["http"]> = {},
): Promise<{ app: Hono; container: Container }> {
  const cfg = makeConfig(cfgOverrides);
  const container = new Container();
  container.registerValue(ConfigKey, cfg);
  container.registerValue(LoggerKey, pino({ level: "silent" }));
  container.registerValue(HealthRegistryKey, new HealthRegistry());
  const app = buildApp(container);
  return { app, container };
}

describe("buildApp", () => {
  it("GET /healthz returns 200 when liveness is healthy", async () => {
    const { app } = await makeApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
  });

  it("GET /readyz returns 200 when readiness is healthy", async () => {
    const { app } = await makeApp();
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
  });

  it("GET /readyz returns 503 with {status:'not ready'} when a checker rejects", async () => {
    const { app, container } = await makeApp();
    const registry = container.resolve<HealthRegistry>(HealthRegistryKey);
    registry.addReadiness({
      name: "failing",
      check: async () => {
        throw new Error("nope");
      },
    });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: "not ready" });
  });

  it("GET /metrics returns 200 with text/plain content-type", async () => {
    const { app } = await makeApp();
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
  });

  it("returns 404 for unknown routes", async () => {
    const { app } = await makeApp();
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
  });

  it("maps a thrown error to 500 INTERNAL", async () => {
    const { app } = await makeApp();
    app.get("/boom", () => {
      throw new Error("x");
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("INTERNAL");
  });
});

describe("buildApp — body limit", () => {
  it("passes requests whose Content-Length is at or under the limit", async () => {
    const { app } = await makeApp({ body_limit: "1K" });
    app.post("/echo", (c) => c.text("ok"));
    const res = await app.request("/echo", {
      method: "POST",
      headers: { "content-length": "512" },
      body: "x".repeat(512),
    });
    expect(res.status).toBe(200);
  });

  it("returns 413 INVALID_INPUT when Content-Length exceeds the limit", async () => {
    const { app } = await makeApp({ body_limit: "1K" });
    app.post("/echo", (c) => c.text("ok"));
    const res = await app.request("/echo", {
      method: "POST",
      headers: { "content-length": "2048" },
      body: "x".repeat(2048),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string; message: string };
    expect(body).toEqual({ error: "INVALID_INPUT", message: "request body too large" });
  });

  it("disables the body limit when the configured value is empty/garbage", async () => {
    const { app } = await makeApp({ body_limit: "nope" });
    app.post("/echo", (c) => c.text("ok"));
    const res = await app.request("/echo", {
      method: "POST",
      headers: { "content-length": "1048576" },
      body: "x".repeat(1024),
    });
    expect(res.status).toBe(200);
  });
});
