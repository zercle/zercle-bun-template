import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  ConfigKey,
  dbConnString,
  httpAddr,
  loadConfig,
  parseDurationToSeconds,
  valkeyAddr,
} from "./config";

const FIXTURE_PATH = new URL("./__fixtures__/config.fixture.yaml", import.meta.url).pathname;

describe("parseDurationToSeconds", () => {
  it("parses seconds suffix", () => {
    expect(parseDurationToSeconds("15s")).toBe(15);
  });

  it("parses minutes suffix", () => {
    expect(parseDurationToSeconds("30m")).toBe(1800);
  });

  it("parses hours suffix", () => {
    expect(parseDurationToSeconds("1h")).toBe(3600);
  });

  it("parses bare numeric string as seconds", () => {
    expect(parseDurationToSeconds("90")).toBe(90);
  });

  it("parses fractional minutes", () => {
    expect(parseDurationToSeconds("1.5m")).toBe(90);
  });

  it("passes numbers through unchanged", () => {
    expect(parseDurationToSeconds(42)).toBe(42);
  });

  it("rejects garbage input", () => {
    expect(() => parseDurationToSeconds("nope")).toThrow(ConfigError);
  });
});

describe("loadConfig — file + env merge", () => {
  beforeEach(() => {
    vi.stubEnv("CONFIG_FILE", FIXTURE_PATH);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads the fixture file and applies defaults", () => {
    const cfg = loadConfig();
    expect(cfg.app.name).toBe("zercle-bun-template-fixture");
    expect(cfg.app.environment).toBe("development");
    expect(cfg.app.port).toBe(8080);
    expect(cfg.app.shutdown_timeout).toBe(15);
    expect(cfg.http.idle_timeout).toBe(60);
    expect(cfg.http.cors_allow_methods).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ]);
    expect(cfg.db.max_conns).toBe(10);
    expect(cfg.db.min_conns).toBe(2);
    expect(cfg.db.max_conn_idle).toBe(1800);
    expect(cfg.example.enabled).toBe(false);
  });

  it("env overrides file values (env wins)", () => {
    vi.stubEnv("APP_NAME", "from-env");
    vi.stubEnv("APP_PORT", "9999");
    vi.stubEnv("HTTP_READ_TIMEOUT", "30s");
    vi.stubEnv("DB_MAX_CONNS", "25");
    vi.stubEnv("HTTP_CORS_ALLOW_ORIGINS", "https://a.example, https://b.example");
    vi.stubEnv("EXAMPLE_ENABLED", "true");
    vi.stubEnv("OTEL_TRACES_SAMPLER_ARG", "0.25");

    const cfg = loadConfig();
    expect(cfg.app.name).toBe("from-env");
    expect(cfg.app.port).toBe(9999);
    expect(cfg.http.read_timeout).toBe(30);
    expect(cfg.db.max_conns).toBe(25);
    expect(cfg.http.cors_allow_origins).toEqual(["https://a.example", "https://b.example"]);
    expect(cfg.example.enabled).toBe(true);
    expect(cfg.otel.sampling).toBe(0.25);
  });

  it("returns ConfigKey symbol with description 'Config'", () => {
    expect(ConfigKey.description).toBe("Config");
  });
});

describe("loadConfig — file missing", () => {
  beforeEach(() => {
    vi.stubEnv("CONFIG_FILE", "/nonexistent/path/does-not-exist.yaml");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats missing config file as empty (env/defaults still apply)", () => {
    // env provides the required db/valkey fields
    vi.stubEnv("DB_HOST", "env-host");
    vi.stubEnv("DB_PORT", "5432");
    vi.stubEnv("DB_NAME", "app");
    vi.stubEnv("DB_USER", "postgres");
    vi.stubEnv("DB_PASSWORD", "postgres");
    vi.stubEnv("VALKEY_HOST", "env-valkey");
    vi.stubEnv("VALKEY_PORT", "6379");

    const cfg = loadConfig();
    expect(cfg.db.host).toBe("env-host");
    expect(cfg.valkey.host).toBe("env-valkey");
    expect(cfg.app.name).toBe("zercle-bun-template");
    expect(cfg.app.port).toBe(8080);
  });
});

describe("loadConfig — cross-section validation", () => {
  beforeEach(() => {
    vi.stubEnv("CONFIG_FILE", FIXTURE_PATH);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws ConfigError when db.max_conns < db.min_conns", () => {
    vi.stubEnv("DB_MAX_CONNS", "1");
    vi.stubEnv("DB_MIN_CONNS", "10");
    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow(/MAX_CONNS.*MIN_CONNS/);
  });

  it("throws ConfigError when otel.exporter=otlp and endpoint is empty", () => {
    vi.stubEnv("OTEL_EXPORTER", "otlp");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow(/OTEL_EXPORTER_OTLP_ENDPOINT/);
  });

  it("throws ConfigError when otel.endpoint is not a valid URL", () => {
    vi.stubEnv("OTEL_EXPORTER", "otlp");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "not a url");
    expect(() => loadConfig()).toThrow(ConfigError);
  });

  it("accepts a valid otel.endpoint with exporter=otlp", () => {
    vi.stubEnv("OTEL_EXPORTER", "otlp");
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318");
    const cfg = loadConfig();
    expect(cfg.otel.exporter).toBe("otlp");
    expect(cfg.otel.endpoint).toBe("http://collector:4318");
  });
});

describe("helpers", () => {
  beforeEach(() => {
    vi.stubEnv("CONFIG_FILE", FIXTURE_PATH);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("httpAddr returns host:port", () => {
    const cfg = loadConfig();
    expect(httpAddr(cfg)).toBe("0.0.0.0:8080");
  });

  it("dbConnString builds a postgres URL with URL-encoded password", () => {
    vi.stubEnv("DB_PASSWORD", "p@ss/word?#");
    const cfg = loadConfig();
    const s = dbConnString(cfg);
    const parsed = new URL(s);
    expect(parsed.protocol).toBe("postgres:");
    expect(parsed.username).toBe("postgres");
    // URL stores password percent-encoded; decode for comparison.
    expect(decodeURIComponent(parsed.password)).toBe("p@ss/word?#");
    expect(parsed.hostname).toBe("localhost");
    expect(parsed.port).toBe("5432");
    expect(parsed.pathname).toBe("/app");
    expect(parsed.searchParams.get("sslmode")).toBe("disable");
    // And the rendered string must NOT contain the unencoded special chars
    // outside the userinfo (i.e. the URL is well-formed and round-trippable).
    expect(parsed.toString()).toBe(s);
  });

  it("valkeyAddr returns host:port", () => {
    const cfg = loadConfig();
    expect(valkeyAddr(cfg)).toBe("localhost:6379");
  });
});
