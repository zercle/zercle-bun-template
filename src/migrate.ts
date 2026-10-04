/**
 * Self-contained database migration runner. Mirrors the Go template's
 * `cmd/migrate/main.go` plus its `internal/fsmerge` composition.
 *
 * Each feature owns its SQL migrations under
 * `src/features/<name>/adapter/out/postgres/migrations`, and this runner merges
 * them into a single global version namespace at run time by asking the feature
 * registry for its `migrationSources()`. There is no embedded filesystem and no
 * external migrator library: dropping a feature from the registry drops its
 * migrations with it, so deleting a feature deletes its schema.
 *
 * Subcommands:
 *   up       (default) apply every pending migration, one transaction each
 *   status   print per-feature applied/pending counts and pending versions
 *   down     step down exactly ONE version, running its `*.down.sql`
 *   --help/-h  print usage
 *
 * `drizzle-kit` only ever generates `*.up.sql` files, so the matching
 * `*.down.sql` files are hand-written by convention; `down` exits 1 when one is
 * missing rather than silently diverging.
 *
 * Exits with 0 on success, 1 on usage error or migration failure. `runMigrate`
 * is exported so tests can drive it with fixture migration directories.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { dbConnString, loadConfig } from "./config/config.ts";
import { migrationSources } from "./features/features.ts";

type Sql = ReturnType<typeof postgres>;

/** One discoverable migration file pair, merged across every feature. */
export interface Migration {
  version: number;
  name: string;
  feature: string;
  /** Absolute directory holding the file (repo-root-relative source resolved against CWD). */
  dir: string;
  upPath: string;
  downPath: string;
}

/** A feature's migrations directory, repo-root-relative. */
export interface MigrationSource {
  feature: string;
  dir: string;
}

const UP_RE = /^(\d+)_(.+)\.up\.sql$/;

/**
 * Discover `<dir>/*.up.sql` across every source and merge them into one list
 * sorted by version ascending. `*.down.sql` files and drizzle-kit's `meta/`
 * subdirectory are ignored. Two files claiming the same version is a hard
 * error: all features share a single global migration namespace.
 */
export function discoverMigrations(sources: MigrationSource[]): Migration[] {
  const out: Migration[] = [];
  const seen = new Map<number, string>();

  for (const source of sources) {
    const dir = resolve(process.cwd(), source.dir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      // A registry entry for a feature whose directory is absent is treated as
      // owning no migrations rather than failing the whole run.
      continue;
    }
    for (const entry of entries) {
      const match = UP_RE.exec(entry);
      if (match === null) continue;
      const version = Number(match[1]);
      const name = match[2] as string;
      const qualified = `${source.feature}/${name}`;
      const existing = seen.get(version);
      if (existing !== undefined) {
        throw new Error(
          `duplicate migration version ${version}: ${existing} and ${qualified} — ` +
            "migrations share a single global namespace",
        );
      }
      seen.set(version, qualified);
      out.push({
        version,
        name,
        feature: source.feature,
        dir,
        upPath: join(dir, entry),
        downPath: join(dir, `${match[1]}_${name}.down.sql`),
      });
    }
  }

  out.sort((a, b) => a.version - b.version);
  return out;
}

/** Create the bookkeeping table if missing. One row per applied version. */
async function ensureSchemaTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      feature TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

interface AppliedRow {
  version: number | bigint;
  name: string;
  feature: string;
}

async function appliedRows(sql: Sql): Promise<AppliedRow[]> {
  return (await sql`
    SELECT version, name, feature FROM schema_migrations ORDER BY version ASC
  `) as unknown as AppliedRow[];
}

/** Apply every pending migration, one transaction per migration. */
async function runUp(sql: Sql, sources: MigrationSource[]): Promise<number> {
  await ensureSchemaTable(sql);
  const migrations = discoverMigrations(sources);
  const applied = new Set((await appliedRows(sql)).map((row) => Number(row.version)));
  const pending = migrations.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log("no pending migrations; schema is current");
    return 0;
  }

  for (const migration of pending) {
    const query = readFileSync(migration.upPath, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(query);
      await tx`
        INSERT INTO schema_migrations (version, name, feature)
        VALUES (${migration.version}, ${migration.name}, ${migration.feature})
      `;
    });
    console.log(`applied ${migration.version} ${migration.feature}/${migration.name}`);
  }
  return 0;
}

/** Print per-feature applied/pending counts and the flat pending version list. */
async function runStatus(sql: Sql, sources: MigrationSource[]): Promise<number> {
  await ensureSchemaTable(sql);
  const migrations = discoverMigrations(sources);
  const applied = new Set((await appliedRows(sql)).map((row) => Number(row.version)));

  const counts = new Map<string, { applied: number; pending: number }>();
  for (const migration of migrations) {
    const entry = counts.get(migration.feature) ?? { applied: 0, pending: 0 };
    if (applied.has(migration.version)) {
      entry.applied += 1;
    } else {
      entry.pending += 1;
    }
    counts.set(migration.feature, entry);
  }

  for (const source of sources) {
    const entry = counts.get(source.feature) ?? { applied: 0, pending: 0 };
    console.log(`feature ${source.feature}: applied ${entry.applied} pending ${entry.pending}`);
  }

  const pendingVersions = migrations.filter((m) => !applied.has(m.version)).map((m) => m.version);
  console.log(
    pendingVersions.length === 0 ? "pending: (none)" : `pending: ${pendingVersions.join(", ")}`,
  );
  return 0;
}

/** Step down exactly one version: run its down SQL, then delete its row. */
async function runDown(sql: Sql, sources: MigrationSource[]): Promise<number> {
  await ensureSchemaTable(sql);
  const rows = await appliedRows(sql);
  const highest = rows.at(-1);
  if (highest === undefined) {
    console.log("no applied migrations to step down");
    return 0;
  }
  const version = Number(highest.version);
  const migrations = discoverMigrations(sources);
  const migration = migrations.find((m) => m.version === version);
  if (migration === undefined) {
    console.error(
      `migrate down failed: version ${version} is applied but its migration file is no longer registered`,
    );
    return 1;
  }

  let query: string;
  try {
    query = readFileSync(migration.downPath, "utf8");
  } catch {
    console.error(
      `migrate down failed: missing down migration ${migration.downPath} ` +
        "(drizzle-kit only generates up files; hand-write the down file)",
    );
    return 1;
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(query);
    await tx`DELETE FROM schema_migrations WHERE version = ${version}`;
  });
  console.log(`reverted ${version} ${migration.feature}/${migration.name}`);
  return 0;
}

/**
 * Parse and execute one migrate invocation. `sources` defaults to every
 * registered feature's migrations; tests pass fixture directories instead.
 */
export async function runMigrate(
  args: string[],
  sources: MigrationSource[] = migrationSources(),
): Promise<number> {
  const cmd = (args[0] ?? "up").toLowerCase();

  if (cmd === "--help" || cmd === "-h") {
    printUsage();
    return 0;
  }
  if (cmd !== "up" && cmd !== "status" && cmd !== "down") {
    console.error(`migrate: unknown command ${args[0] ?? ""}`);
    printUsage();
    return 1;
  }

  let cfg: ReturnType<typeof loadConfig>;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(
      `migrate: loadConfig failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }

  const sql = postgres(dbConnString(cfg), { max: 1 });
  try {
    if (cmd === "up") return await runUp(sql, sources);
    if (cmd === "status") return await runStatus(sql, sources);
    return await runDown(sql, sources);
  } catch (err) {
    console.error(`migrate ${cmd} failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    await sql.end().catch(() => undefined);
  }
}

function printUsage(): void {
  console.log("usage: migrate [up|status|down]");
}

if (import.meta.main) {
  const exitCode = await runMigrate(process.argv.slice(2));
  process.exit(exitCode);
}
