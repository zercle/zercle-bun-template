/**
 * Integration-test database harness. Mirrors the Go template's
 * `internal/testutil/db.go` role (shared per-test setup) plus the suite-level
 * migration + reset helpers every postgres repository integration suite needs.
 *
 * These tests run against a LIVE PostgreSQL. There is deliberately no env-based
 * skip: an unreachable database fails the run, exactly like the Go suites. The
 * only hard guard is the production-environment refusal below, also mirrored
 * from Go (`APP_ENVIRONMENT=production` aborts rather than skips).
 */
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { migrationSources } from "../features/features.ts";
import { type Config, dbConnString, loadConfig } from "../infrastructure/config/config.ts";
import { createDB, type DB, type DBHandle } from "../infrastructure/db/index.ts";
import { runMigrate } from "../migrate.ts";

/**
 * Session-level advisory-lock key. Every suite holds it for its lifetime, so
 * suites that share one database (and TRUNCATE each other's tables) run one at
 * a time even though Vitest runs test files in parallel. The value is an
 * arbitrary application constant ("zercl" in ASCII); it only has to be stable.
 */
const INTEGRATION_ADVISORY_LOCK_KEY = 0x7a6572636c65;

/**
 * Load the env-bound config for integration tests and refuse to run against
 * production. Mirrors the Go suites' `SetupSuite` guard: a production
 * environment is a hard failure, never a skip.
 */
export function loadIntegrationConfig(): Config {
  const cfg = loadConfig();
  if (cfg.app.environment === "production") {
    throw new Error(
      "integration tests must not run against production environment (APP_ENVIRONMENT=production)",
    );
  }
  return cfg;
}

/**
 * Open a connected Drizzle handle over the integration database and apply every
 * feature's migrations from ONE merged source.
 *
 * Reuses the production migration runner (`discoverMigrations` +
 * `runMigrate` over `migrationSources()`), which is the TypeScript equivalent of
 * the Go suites' `fsmerge` merge: per-feature sources against a shared
 * `schema_migrations` table would fight over the shared version namespace. The
 * runner is idempotent, so re-applying against a current database is a no-op.
 *
 * The returned handle holds a cross-suite advisory lock until `end()` is called;
 * the caller must `end()` it in `afterAll`.
 */
export async function newIntegrationDB(): Promise<DBHandle> {
  const cfg = loadIntegrationConfig();
  const lockSql = postgres(dbConnString(cfg), { max: 1 });

  try {
    await lockSql`SELECT pg_advisory_lock(${INTEGRATION_ADVISORY_LOCK_KEY})`;
  } catch (err) {
    await lockSql.end().catch(() => undefined);
    throw err;
  }

  try {
    const handle = await createDB(cfg);
    const code = await runMigrate(["up"], migrationSources());
    if (code !== 0) {
      await handle.end();
      throw new Error("integration migrations failed (see migrate output above)");
    }
    return {
      db: handle.db,
      sql: handle.sql,
      end: async () => {
        await lockSql`SELECT pg_advisory_unlock(${INTEGRATION_ADVISORY_LOCK_KEY})`;
        await lockSql.end();
        await handle.end();
      },
    };
  } catch (err) {
    await lockSql`SELECT pg_advisory_unlock(${INTEGRATION_ADVISORY_LOCK_KEY})`.catch(
      () => undefined,
    );
    await lockSql.end().catch(() => undefined);
    throw err;
  }
}

const TABLE_NAME_RE = /^[a-z_][a-z0-9_]*$/;

/**
 * Clear the given tables and reset their identity sequences, so each test case
 * starts from an empty, deterministic schema. `CASCADE` also clears rows in
 * other tables that reference them (mirroring the Go `reset*State` helpers).
 */
export async function truncateTables(db: DB, ...tables: string[]): Promise<void> {
  if (tables.length === 0) {
    throw new Error("truncateTables: at least one table is required");
  }
  for (const table of tables) {
    if (!TABLE_NAME_RE.test(table)) {
      throw new Error(`truncateTables: unsafe table name: ${table}`);
    }
  }
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`));
}
