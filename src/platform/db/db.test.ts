import { afterEach, describe, expect, it, vi } from "vitest";
import type { DBHandle } from "./db";
import { postgresChecker } from "./health";

// Mock the postgres-js driver so unit tests don't touch the network.
vi.mock("postgres", () => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const endFn = vi.fn(() => Promise.resolve());
  const fakeSql = Object.assign(sqlFn, { end: endFn });
  const factory = vi.fn((_opts: unknown) => fakeSql);
  return {
    default: factory,
    __factory: factory,
    __sqlFn: sqlFn,
    __endFn: endFn,
  };
});

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({ _drizzle: true }),
}));

import { createDB } from "./db";

const baseDbCfg = {
  host: "localhost",
  port: 5432,
  name: "app",
  user: "postgres",
  password: "postgres",
  ssl_mode: "disable" as const,
  max_conns: 10,
  min_conns: 2,
  max_conn_idle: 1800,
  max_conn_life: 3600,
  connect_timeout: 5,
};

const fullCfg = {
  app: {
    name: "test",
    environment: "test" as const,
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
    cors_allow_methods: ["GET", "POST"],
    cors_allow_headers: ["Authorization"],
  },
  db: baseDbCfg,
  valkey: {
    host: "localhost",
    port: 6379,
    password: "",
    db: 0,
    connect_timeout: 5,
  },
  otel: {
    exporter: "none" as const,
    endpoint: "",
    service_name: "test",
    sampling: 1,
  },
  log: { level: "info" as const, format: "json" as const },
  example: {
    enabled: false,
    default_page_size: 20,
    max_page_size: 100,
    max_name_length: 255,
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

interface PostgresMock {
  __factory: ReturnType<typeof vi.fn>;
  __sqlFn: ReturnType<typeof vi.fn>;
  __endFn: ReturnType<typeof vi.fn>;
}

async function loadPostgresMock(): Promise<PostgresMock> {
  const mod = await import("postgres");
  return mod as unknown as PostgresMock;
}

describe("createDB", () => {
  it("rejects when the initial ping fails and closes the underlying client", async () => {
    const { __sqlFn, __endFn } = await loadPostgresMock();
    __sqlFn.mockImplementationOnce(() => Promise.reject(new Error("connection refused")));

    await expect(createDB(fullCfg)).rejects.toThrow(/ping db/);
    expect(__endFn).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("returns a handle with end(), db, sql when the ping succeeds", async () => {
    const { __sqlFn } = await loadPostgresMock();
    __sqlFn.mockImplementation(() => Promise.resolve([]));

    const handle = await createDB(fullCfg);
    expect(typeof handle.end).toBe("function");
    expect(handle.db).toBeDefined();
    expect(handle.sql).toBeDefined();

    await handle.end();
  });

  it("disables SSL when ssl_mode is disable", async () => {
    const { __factory } = await loadPostgresMock();
    await createDB(fullCfg);
    const opts = __factory.mock.calls.at(-1)?.[1] as { ssl: unknown };
    expect(opts.ssl).toBe(false);
  });

  it("passes the 'require' string to postgres when ssl_mode is require", async () => {
    const { __factory } = await loadPostgresMock();
    await createDB({ ...fullCfg, db: { ...fullCfg.db, ssl_mode: "require" } });
    const opts = __factory.mock.calls.at(-1)?.[1] as { ssl: unknown };
    expect(opts.ssl).toBe("require");
  });

  it("passes the 'prefer' string to postgres when ssl_mode is prefer", async () => {
    const { __factory } = await loadPostgresMock();
    await createDB({ ...fullCfg, db: { ...fullCfg.db, ssl_mode: "prefer" } });
    const opts = __factory.mock.calls.at(-1)?.[1] as { ssl: unknown };
    expect(opts.ssl).toBe("prefer");
  });

  it("requires verification when ssl_mode is verify-ca", async () => {
    const { __factory } = await loadPostgresMock();
    await createDB({ ...fullCfg, db: { ...fullCfg.db, ssl_mode: "verify-ca" } });
    const opts = __factory.mock.calls.at(-1)?.[1] as { ssl: { rejectUnauthorized: boolean } };
    expect(opts.ssl.rejectUnauthorized).toBe(true);
  });

  it("requires verification when ssl_mode is verify-full", async () => {
    const { __factory } = await loadPostgresMock();
    await createDB({ ...fullCfg, db: { ...fullCfg.db, ssl_mode: "verify-full" } });
    const opts = __factory.mock.calls.at(-1)?.[1] as { ssl: { rejectUnauthorized: boolean } };
    expect(opts.ssl.rejectUnauthorized).toBe(true);
  });
});

describe("postgresChecker", () => {
  function makeHandle(ping: () => Promise<unknown>): DBHandle {
    const sqlFn = ping as unknown as DBHandle["sql"];
    return {
      db: {} as DBHandle["db"],
      sql: sqlFn,
      end: () => Promise.resolve(),
    };
  }

  it("has name 'postgres'", () => {
    const handle = makeHandle(() => Promise.resolve([]));
    const checker = postgresChecker(handle);
    expect(checker.name).toBe("postgres");
  });

  it("resolves when the underlying SELECT 1 resolves", async () => {
    const handle = makeHandle(() => Promise.resolve([]));
    const checker = postgresChecker(handle);
    await expect(checker.check()).resolves.toBeUndefined();
  });

  it("rejects when the underlying SELECT 1 rejects", async () => {
    const handle = makeHandle(() => Promise.reject(new Error("db down")));
    const checker = postgresChecker(handle);
    await expect(checker.check()).rejects.toThrow(/db down/);
  });
});
