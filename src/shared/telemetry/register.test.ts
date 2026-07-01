/**
 * Unit tests for the shared telemetry layer's DI registration and the
 * `startTracer` factory. We mock the OpenTelemetry SDK and exporter to
 * exercise both the "none" and "otlp" branches without touching the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";

const { sdkInstances, otlpInstances, startCalls } = vi.hoisted(() => {
  return {
    sdkInstances: [] as Array<{
      start: ReturnType<typeof vi.fn>;
      shutdown: ReturnType<typeof vi.fn>;
    }>,
    otlpInstances: [] as Array<{ url: string }>,
    startCalls: { count: 0 },
  };
});

vi.mock("@opentelemetry/sdk-node", () => {
  class NodeSDK {
    start = vi.fn(() => {
      startCalls.count += 1;
    });
    shutdown = vi.fn().mockResolvedValue(undefined);
    constructor(_opts?: unknown) {
      sdkInstances.push(this);
    }
  }
  return { NodeSDK };
});

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => {
  class OTLPTraceExporter {
    url: string;
    constructor(opts: { url: string }) {
      this.url = opts.url;
      otlpInstances.push(this);
    }
  }
  return { OTLPTraceExporter };
});

vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: (attrs: Record<string, unknown>) => attrs,
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  ParentBasedSampler: class {
    root: unknown;
    constructor(opts: { root: unknown }) {
      this.root = opts.root;
    }
  },
  TraceIdRatioBasedSampler: class {
    ratio: number;
    constructor(ratio: number) {
      this.ratio = ratio;
    }
  },
}));

afterEach(() => {
  sdkInstances.length = 0;
  otlpInstances.length = 0;
  startCalls.count = 0;
  vi.restoreAllMocks();
});

function makeCfg(overrides: Partial<Config["otel"]> = {}): Config {
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
    otel: {
      exporter: "none",
      endpoint: "",
      service_name: "t",
      sampling: 1,
      ...overrides,
    },
    log: { level: "error", format: "json" },
    example: { enabled: false, default_page_size: 1, max_page_size: 1, max_name_length: 1 },
  } as Config;
}

describe("startTracer", () => {
  beforeEach(() => {
    sdkInstances.length = 0;
    otlpInstances.length = 0;
    startCalls.count = 0;
  });

  it("returns null when exporter is none and never starts the SDK", async () => {
    const { startTracer } = await import("./tracer.ts");
    const handle = await startTracer(makeCfg({ exporter: "none" }));
    expect(handle).toBeNull();
    expect(startCalls.count).toBe(0);
  });

  it("starts the OTLP SDK and normalizes endpoint without /v1/traces", async () => {
    const { startTracer } = await import("./tracer.ts");
    const handle = await startTracer(
      makeCfg({ exporter: "otlp", endpoint: "http://collector:4318" }),
    );
    expect(handle).not.toBeNull();
    expect(startCalls.count).toBe(1);
    expect(otlpInstances[0]?.url).toBe("http://collector:4318/v1/traces");
  });

  it("preserves the /v1/traces suffix when already present", async () => {
    const { startTracer } = await import("./tracer.ts");
    await startTracer(makeCfg({ exporter: "otlp", endpoint: "http://collector:4318/v1/traces" }));
    expect(otlpInstances[0]?.url).toBe("http://collector:4318/v1/traces");
  });

  it("trims trailing slashes before appending /v1/traces", async () => {
    const { startTracer } = await import("./tracer.ts");
    await startTracer(makeCfg({ exporter: "otlp", endpoint: "http://collector:4318///" }));
    expect(otlpInstances[0]?.url).toBe("http://collector:4318/v1/traces");
  });

  it("exposes a shutdown handle that delegates to NodeSDK.shutdown", async () => {
    const { startTracer } = await import("./tracer.ts");
    const handle = await startTracer(
      makeCfg({ exporter: "otlp", endpoint: "http://collector:4318" }),
    );
    await handle?.shutdown();
    const sdk = sdkInstances[0];
    expect(sdk?.shutdown).toHaveBeenCalledTimes(1);
  });
});

describe("telemetry.register", () => {
  it("registers logger, meter, health, and tracer when otlp is enabled", async () => {
    const { register } = await import("./register.ts");
    const { HealthRegistryKey, LoggerKey, MeterKey, TracerKey } = await import("./index.ts");
    const container = new Container();
    container.registerValue(
      ConfigKey,
      makeCfg({ exporter: "otlp", endpoint: "http://collector:4318" }),
    );
    await register(container);
    expect(container.resolve(LoggerKey)).toBeDefined();
    expect(container.resolve(MeterKey)).toBeDefined();
    expect(container.resolve(HealthRegistryKey)).toBeDefined();
    expect(container.resolve(TracerKey)).toBeDefined();
  });

  it("skips tracer registration when exporter is none", async () => {
    const { register } = await import("./register.ts");
    const { TracerKey } = await import("./index.ts");
    const container = new Container();
    container.registerValue(ConfigKey, makeCfg({ exporter: "none" }));
    await register(container);
    expect(container.tryResolve(TracerKey)).toBeUndefined();
  });
});
