import { afterEach, describe, expect, it, vi } from "vitest";
import { Container } from "../../app/container";
import type { Config } from "../../config/config";
import { ConfigKey } from "../../config/config";
import { HealthRegistry, HealthRegistryKey } from "../../shared/telemetry/health";
import { createValkey, type ValkeyClient, valkeyChecker } from "./valkey";

function makeConfig(overrides: Partial<Config["valkey"]> = {}): Config {
  return {
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
    valkey: {
      host: "localhost",
      port: 6379,
      password: "",
      db: 0,
      connect_timeout: 5,
      ...overrides,
    },
    otel: { exporter: "none", endpoint: "", service_name: "zercle-bun-template", sampling: 1.0 },
    log: { level: "info", format: "json" },
    example: { enabled: false, default_page_size: 20, max_page_size: 100, max_name_length: 255 },
  };
}

type FakeRedis = {
  ping: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  options: Record<string, unknown>;
};

let lastFakeRedis: FakeRedis | null = null;
let nextConnectImpl: (() => Promise<void>) | null = null;
let nextPingImpl: (() => Promise<string>) | null = null;

vi.mock("ioredis", () => {
  class FakeRedisImpl {
    public ping: ReturnType<typeof vi.fn>;
    public connect: ReturnType<typeof vi.fn>;
    public disconnect: ReturnType<typeof vi.fn>;
    public quit: ReturnType<typeof vi.fn>;
    public options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.ping = vi.fn(() => {
        if (nextPingImpl) {
          const impl = nextPingImpl;
          nextPingImpl = null;
          return impl();
        }
        return Promise.resolve("PONG");
      });
      this.connect = vi.fn(() => {
        if (nextConnectImpl) {
          const impl = nextConnectImpl;
          nextConnectImpl = null;
          return impl();
        }
        return Promise.resolve();
      });
      this.disconnect = vi.fn();
      this.quit = vi.fn().mockResolvedValue("OK");
      lastFakeRedis = this as unknown as FakeRedis;
    }
  }
  return { default: FakeRedisImpl };
});

afterEach(() => {
  lastFakeRedis = null;
  nextConnectImpl = null;
  nextPingImpl = null;
  vi.clearAllMocks();
});

describe("valkeyChecker", () => {
  it('resolves when ping() returns "PONG"', async () => {
    const client = { ping: vi.fn().mockResolvedValue("PONG") } as unknown as ValkeyClient;
    const checker = valkeyChecker(client);
    expect(checker.name).toBe("valkey");
    await expect(checker.check()).resolves.toBeUndefined();
    expect(client.ping).toHaveBeenCalledTimes(1);
  });

  it("rejects when ping() throws", async () => {
    const client = {
      ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    } as unknown as ValkeyClient;
    const checker = valkeyChecker(client);
    await expect(checker.check()).rejects.toThrow(/ECONNREFUSED/);
  });

  it("rejects when ping() returns a non-PONG string", async () => {
    const client = { ping: vi.fn().mockResolvedValue("NOPE") } as unknown as ValkeyClient;
    const checker = valkeyChecker(client);
    await expect(checker.check()).rejects.toThrow(/unexpected ping response: NOPE/);
  });
});

describe("createValkey", () => {
  it("constructs with mapped options, connects, pings, and returns the client", async () => {
    const cfg = makeConfig({
      host: "redis.example",
      port: 6390,
      password: "secret",
      db: 2,
      connect_timeout: 3,
    });
    const client = await createValkey(cfg);
    expect(client).toBeDefined();
    const fake = lastFakeRedis as FakeRedis | null;
    expect(fake).not.toBeNull();
    if (!fake) throw new Error("fake redis not captured");
    expect(fake.options).toEqual({
      host: "redis.example",
      port: 6390,
      password: "secret",
      db: 2,
      connectTimeout: 3000,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    expect(fake.connect).toHaveBeenCalledTimes(1);
    expect(fake.ping).toHaveBeenCalledTimes(1);
    expect(fake.disconnect).not.toHaveBeenCalled();
  });

  it("treats an empty password as no password", async () => {
    const cfg = makeConfig({ password: "" });
    await createValkey(cfg);
    const fake = lastFakeRedis as FakeRedis | null;
    expect(fake).not.toBeNull();
    if (!fake) throw new Error("fake redis not captured");
    expect(fake.options.password).toBeUndefined();
  });

  it("disconnects and throws a wrapped error when connect() fails", async () => {
    const cfg = makeConfig();
    nextConnectImpl = () => Promise.reject(new Error("dial tcp: connection refused"));
    await expect(createValkey(cfg)).rejects.toThrow(/connect valkey localhost:6379: dial tcp/);
    const fake = lastFakeRedis as FakeRedis | null;
    expect(fake).not.toBeNull();
    if (!fake) throw new Error("fake redis not captured");
    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects and throws a wrapped error when ping() fails", async () => {
    const cfg = makeConfig();
    nextPingImpl = () => Promise.reject(new Error("MOVED 0 127.0.0.1:6379"));
    await expect(createValkey(cfg)).rejects.toThrow(/MOVED 0 127.0.0.1:6379/);
    const fake = lastFakeRedis as FakeRedis | null;
    expect(fake).not.toBeNull();
    if (!fake) throw new Error("fake redis not captured");
    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("register", () => {
  it("registers the client under ValkeyKey and adds a readiness checker", async () => {
    const container = new Container();
    const cfg = makeConfig();
    container.registerValue(ConfigKey, cfg);
    container.registerValue(HealthRegistryKey, new HealthRegistry());

    const { ValkeyKey, register } = await import("./valkey");
    await register(container);

    const client = container.resolve<ValkeyClient>(ValkeyKey);
    expect(client).toBeDefined();

    const registry = container.resolve<HealthRegistry>(HealthRegistryKey);
    // Verify the checker is wired in by exercising the public ready() path.
    await expect(registry.ready()).resolves.toBeUndefined();
  });

  it("throws when ConfigKey is not registered", async () => {
    const container = new Container();
    container.registerValue(HealthRegistryKey, new HealthRegistry());
    const { register } = await import("./valkey");
    await expect(register(container)).rejects.toThrow(/dependency not registered: Config/);
  });
});
