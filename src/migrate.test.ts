/**
 * Unit tests for the migration runner. We mock the postgres driver, the
 * drizzle migrator, and `loadConfig` so we can drive every branch of
 * `runMigrate` (--help, up success, up failure, status success, status
 * failure, unknown command, and loadConfig failure) without touching real
 * services.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sqlFn, endFn, fakeSql, migrateFn } = vi.hoisted(() => {
  const sqlFn = vi.fn(() => Promise.resolve([]));
  const endFn = vi.fn(() => Promise.resolve());
  const fakeSql = Object.assign(sqlFn, { end: endFn });
  const migrateFn = vi.fn().mockResolvedValue(undefined);
  return { sqlFn, endFn, fakeSql, migrateFn };
});

vi.mock("postgres", () => ({
  default: () => fakeSql,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: () => ({ _drizzle: true }),
}));

vi.mock("drizzle-orm/postgres-js/migrator", () => ({
  migrate: migrateFn,
}));

vi.mock("./config/config.ts", () => ({
  loadConfig: vi.fn(() => ({
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
  })),
  dbConnString: () => "postgres://x",
}));

beforeEach(() => {
  sqlFn.mockReset().mockImplementation(() => Promise.resolve([]));
  endFn.mockReset().mockImplementation(() => Promise.resolve());
  migrateFn.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runMigrate", () => {
  it("prints usage and returns 0 on --help", async () => {
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["--help"]);
    expect(code).toBe(0);
  });

  it("applies migrations and exits 0 on up", async () => {
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["up"]);
    expect(code).toBe(0);
    expect(migrateFn).toHaveBeenCalledTimes(1);
    expect(endFn).toHaveBeenCalled();
  });

  it("returns 1 when migrate() rejects", async () => {
    migrateFn.mockRejectedValueOnce(new Error("drizzle boom"));
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["up"]);
    expect(code).toBe(1);
    expect(endFn).toHaveBeenCalled();
  });

  it("returns 0 on status when the count query returns rows", async () => {
    sqlFn.mockImplementationOnce(() => Promise.resolve([{ count: 3 }] as never));
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["status"]);
    expect(code).toBe(0);
  });

  it("returns 0 on status when the query rejects (best-effort)", async () => {
    sqlFn.mockImplementationOnce(() => Promise.reject(new Error("no table")));
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["status"]);
    expect(code).toBe(0);
  });

  it("returns 1 for an unknown command", async () => {
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["wat"]);
    expect(code).toBe(1);
  });

  it("returns 1 when loadConfig rejects", async () => {
    const cfgMod = await import("./config/config.ts");
    (cfgMod.loadConfig as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    const { runMigrate } = await import("./migrate.ts");
    const code = await runMigrate(["up"]);
    expect(code).toBe(1);
  });
});
