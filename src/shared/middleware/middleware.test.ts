import { Hono } from "hono";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../config/config.ts";
import { httpError } from "../errors/mapper.ts";
import { accessLog } from "./access-log.ts";
import { getRequestId } from "./context.ts";
import { cors } from "./cors.ts";
import { recover } from "./recover.ts";
import { MAX_REQUEST_ID_LEN, REQUEST_ID_HEADER, requestId } from "./request-id.ts";

function makeConfig(overrides: Partial<Config["http"]> = {}): Config {
  return {
    app: {
      name: "zercle-bun-template",
      environment: "development",
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
      cors_allow_origins: ["https://example.com"],
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
    log: { level: "info", format: "json" },
    example: { enabled: false, default_page_size: 20, max_page_size: 100, max_name_length: 255 },
  } as Config;
}

describe("requestId middleware", () => {
  it("generates an id when no X-Request-ID header is supplied", async () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/", (c) => c.json({ id: getRequestId() }));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const headerId = res.headers.get(REQUEST_ID_HEADER);
    expect(headerId).toBeTruthy();
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(headerId);
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("preserves a valid X-Request-ID header", async () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/", (c) => c.json({ id: getRequestId() }));

    const supplied = "abcXYZ-0123_zzz";
    const res = await app.request("/", { headers: { [REQUEST_ID_HEADER]: supplied } });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(supplied);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(supplied);
  });

  it("replaces an invalid X-Request-ID header (with spaces)", async () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/", { headers: { [REQUEST_ID_HEADER]: "bad id with spaces" } });
    const echoed = res.headers.get(REQUEST_ID_HEADER);
    expect(echoed).toBeTruthy();
    expect(echoed).not.toBe("bad id with spaces");
    expect(echoed).not.toContain(" ");
  });

  it("replaces an X-Request-ID header that exceeds MAX_REQUEST_ID_LEN", async () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/", (c) => c.text("ok"));

    const tooLong = "a".repeat(MAX_REQUEST_ID_LEN + 1);
    const res = await app.request("/", { headers: { [REQUEST_ID_HEADER]: tooLong } });
    const echoed = res.headers.get(REQUEST_ID_HEADER);
    expect(echoed).toBeTruthy();
    expect(echoed).not.toBe(tooLong);
    expect(echoed?.length).toBeLessThanOrEqual(MAX_REQUEST_ID_LEN);
  });
});

describe("recover middleware", () => {
  it("logs the panic and delegates to onError, which maps to 500 INTERNAL", async () => {
    const logger = pino({ level: "silent" });
    const errorSpy = vi.spyOn(logger, "error");
    const app = new Hono();
    app.use("*", recover(logger));
    app.onError((err, c) => {
      const { status, body } = httpError(err);
      return c.json(body, status as 500);
    });
    app.get("/boom", () => {
      throw new Error("kaboom");
    });

    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("INTERNAL");
    expect(body.message).toBe("internal error");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("does not crash on a clean request", async () => {
    const logger = pino({ level: "silent" });
    const app = new Hono();
    app.use("*", recover(logger));
    app.get("/", (c) => c.text("fine"));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("fine");
  });
});

describe("accessLog middleware", () => {
  it("logs one info line per request with method, path, status, latency_ms", async () => {
    const logger = pino({ level: "silent" });
    const infoSpy = vi.spyOn(logger, "info");
    const app = new Hono();
    app.use("*", accessLog(logger));
    app.get("/ping", (c) => c.text("pong"));

    const res = await app.request("/ping");
    expect(res.status).toBe(200);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const args = infoSpy.mock.calls[0] ?? [];
    const ctx = (args[0] ?? {}) as Record<string, unknown>;
    expect(ctx.method).toBe("GET");
    expect(ctx.path).toBe("/ping");
    expect(ctx.status).toBe(200);
    expect(typeof ctx.latency_ms).toBe("number");
    expect(args[1]).toBe("http request");
  });
});

describe("cors middleware", () => {
  it("reflects the configured origin in Access-Control-Allow-Origin", async () => {
    const app = new Hono();
    app.use("*", cors(makeConfig({ cors_allow_origins: ["https://example.com"] })));
    app.get("/", (c) => c.text("hi"));

    const res = await app.request("/", { headers: { Origin: "https://example.com" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  it("uses '*' when no origins are configured", async () => {
    const app = new Hono();
    app.use("*", cors(makeConfig({ cors_allow_origins: [] })));
    app.get("/", (c) => c.text("hi"));

    const res = await app.request("/", { headers: { Origin: "https://anywhere.test" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("otel middleware", () => {
  it("passes the request through without throwing when no tracer provider is registered", async () => {
    const app = new Hono();
    const { otel } = await import("./otel.ts");
    app.use("*", otel());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
