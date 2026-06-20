/**
 * Migration runner entry point. Mirrors Go `cmd/migrate/main.go`.
 *
 * Subcommands:
 *   up       (default) apply pending migrations from ./migrations
 *   status   print applied migration count (best-effort)
 *
 * Exits with 0 on success, 1 on usage error or migration failure.
 *
 * `runMigrate(args)` is exported so the runner can be exercised in tests.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dbConnString, loadConfig } from "./config/config.ts";

const MIGRATIONS_FOLDER = "./migrations";

export async function runMigrate(args: string[]): Promise<number> {
  const cmd = (args[0] ?? "up").toLowerCase();

  if (cmd === "--help" || cmd === "-h") {
    printUsage();
    return 0;
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

  if (cmd === "up") {
    const sql = postgres(dbConnString(cfg), { max: 1 });
    try {
      const db = drizzle(sql);
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      console.log("migrations applied");
      return 0;
    } catch (err) {
      console.error(`migrate up failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    } finally {
      await sql.end().catch(() => undefined);
    }
  }

  if (cmd === "status") {
    const sql = postgres(dbConnString(cfg), { max: 1 });
    try {
      const rows = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "__drizzle_migrations"
      `.catch(() => []);
      const count = rows[0]?.count ?? 0;
      console.log(`applied migrations: ${count}`);
      console.log("(use 'drizzle-kit generate' to author new migrations)");
      return 0;
    } catch (err) {
      console.error(`migrate status failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    } finally {
      await sql.end().catch(() => undefined);
    }
  }

  console.error(`usage: migrate [up|status]`);
  return 1;
}

function printUsage(): void {
  console.log("usage: migrate [up|status]");
}

const exitCode = await runMigrate(process.argv.slice(2));
process.exit(exitCode);
