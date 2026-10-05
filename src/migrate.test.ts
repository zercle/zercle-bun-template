import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AppliedRow {
  version: number;
  name: string;
  feature: string;
}

const { state, endFn, sql } = vi.hoisted(() => {
  const state = { applied: [] as AppliedRow[] };

  function build(target: typeof state): unknown {
    const tagged = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
      const text = strings.join("?");
      if (text.includes("SELECT version")) {
        return Promise.resolve([...target.applied] as unknown[]);
      }
      if (text.includes("INSERT INTO schema_migrations")) {
        target.applied.push({
          version: Number(values[0]),
          name: String(values[1]),
          feature: String(values[2]),
        });
        return Promise.resolve([]);
      }
      if (text.includes("DELETE FROM schema_migrations")) {
        target.applied = target.applied.filter((row) => row.version !== Number(values[0]));
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    };
    const sqlWithHelpers = tagged as unknown as {
      unsafe: (query: string) => Promise<unknown[]>;
      begin: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
      end: () => Promise<void>;
    };
    sqlWithHelpers.unsafe = () => Promise.resolve([]);
    sqlWithHelpers.begin = (fn) => fn(build(target));
    sqlWithHelpers.end = () => Promise.resolve();
    return sqlWithHelpers;
  }

  const endFn = vi.fn(() => Promise.resolve());
  const sql = build(state) as { end: () => Promise<void> };
  sql.end = endFn;
  return { state, endFn, sql };
});

vi.mock("postgres", () => ({
  default: () => sql,
}));

vi.mock("./infrastructure/config/config.ts", () => ({
  loadConfig: vi.fn(() => ({ db: { host: "x" } })),
  dbConnString: () => "postgres://x",
}));

/** Create a throwaway migration source dir seeded with the given files. */
function makeSource(
  feature: string,
  files: Record<string, string>,
): { feature: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), `migrate-${feature}-`));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  tempDirs.push(dir);
  return { feature, dir };
}

const tempDirs: string[] = [];

beforeEach(() => {
  state.applied = [];
  endFn.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

async function load(): Promise<typeof import("./migrate.ts")> {
  return import("./migrate.ts");
}

describe("runMigrate usage", () => {
  it("prints usage and returns 0 on --help", async () => {
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runMigrate(["--help"], [])).toBe(0);
    expect(log).toHaveBeenCalled();
  });

  it("returns 1 for an unknown command", async () => {
    const { runMigrate } = await load();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runMigrate(["wat"], [])).toBe(1);
  });

  it("returns 1 when loadConfig throws", async () => {
    const cfg = await import("./infrastructure/config/config.ts");
    (cfg.loadConfig as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    const { runMigrate } = await load();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runMigrate(["up"], [])).toBe(1);
  });
});

describe("runMigrate up", () => {
  it("applies pending migrations from every source in version order", async () => {
    const sources = [
      makeSource("catalog", { "000001_create_products.up.sql": "CREATE TABLE products();" }),
      makeSource("sales", { "000003_create_purchases.up.sql": "CREATE TABLE purchases();" }),
    ];
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await runMigrate(["up"], sources)).toBe(0);
    expect(log).toHaveBeenCalledWith("applied 1 catalog/create_products");
    expect(log).toHaveBeenCalledWith("applied 3 sales/create_purchases");
    expect(state.applied.map((r) => r.version)).toEqual([1, 3]);
    expect(endFn).toHaveBeenCalled();
  });

  it("is a no-op when every migration is already applied", async () => {
    state.applied = [{ version: 1, name: "create_products", feature: "catalog" }];
    const sources = [makeSource("catalog", { "000001_create_products.up.sql": "SELECT 1;" })];
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await runMigrate(["up"], sources)).toBe(0);
    expect(log).toHaveBeenCalledWith("no pending migrations; schema is current");
  });

  it("returns 1 when two features claim the same version", async () => {
    const sources = [
      makeSource("catalog", { "000001_create_products.up.sql": "SELECT 1;" }),
      makeSource("sales", { "000001_create_purchases.up.sql": "SELECT 1;" }),
    ];
    const { runMigrate } = await load();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await runMigrate(["up"], sources)).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("single global namespace"));
  });

  it("ignores down files and the drizzle meta directory", async () => {
    const sources = [
      makeSource("catalog", {
        "000001_create_products.up.sql": "SELECT 1;",
        "000001_create_products.down.sql": "DROP TABLE products;",
        "notes.down.sql": "SELECT 2;",
      }),
    ];
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await runMigrate(["up"], sources)).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("applied 1 catalog/create_products");
  });
});

describe("runMigrate status", () => {
  it("reports per-feature applied/pending counts and the pending list", async () => {
    state.applied = [{ version: 1, name: "create_products", feature: "catalog" }];
    const sources = [
      makeSource("catalog", {
        "000001_create_products.up.sql": "SELECT 1;",
        "000002_add_products.up.sql": "SELECT 1;",
      }),
      makeSource("sales", { "000003_create_purchases.up.sql": "SELECT 1;" }),
    ];
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await runMigrate(["status"], sources)).toBe(0);
    expect(log).toHaveBeenCalledWith("feature catalog: applied 1 pending 1");
    expect(log).toHaveBeenCalledWith("feature sales: applied 0 pending 1");
    expect(log).toHaveBeenCalledWith("pending: 2, 3");
  });
});

describe("runMigrate down", () => {
  it("steps down the highest applied version and deletes its row", async () => {
    state.applied = [{ version: 1, name: "create_products", feature: "catalog" }];
    const sources = [
      makeSource("catalog", {
        "000001_create_products.up.sql": "SELECT 1;",
        "000001_create_products.down.sql": "DROP TABLE products;",
      }),
    ];
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await runMigrate(["down"], sources)).toBe(0);
    expect(log).toHaveBeenCalledWith("reverted 1 catalog/create_products");
    expect(state.applied).toEqual([]);
  });

  it("returns 1 when the down file is missing", async () => {
    state.applied = [{ version: 1, name: "create_products", feature: "catalog" }];
    const sources = [makeSource("catalog", { "000001_create_products.up.sql": "SELECT 1;" })];
    const { runMigrate } = await load();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await runMigrate(["down"], sources)).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("missing down migration"));
  });

  it("is a no-op when nothing is applied", async () => {
    const { runMigrate } = await load();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(await runMigrate(["down"], [])).toBe(0);
    expect(log).toHaveBeenCalledWith("no applied migrations to step down");
  });
});

describe("discoverMigrations", () => {
  it("sorts merged versions ascending regardless of source order", async () => {
    const sources = [
      makeSource("sales", { "000003_create_purchases.up.sql": "SELECT 1;" }),
      makeSource("catalog", { "000001_create_products.up.sql": "SELECT 1;" }),
      makeSource("machines", { "000002_create_machines.up.sql": "SELECT 1;" }),
    ];
    const { discoverMigrations } = await load();
    expect(discoverMigrations(sources).map((m) => m.version)).toEqual([1, 2, 3]);
  });
});
