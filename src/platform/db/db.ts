import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type Config, dbConnString } from "../../config/config";

/**
 * Schema-agnostic Drizzle handle. Table definitions are owned by each
 * feature's driven adapter (e.g. `features/example/adapter/out/postgres`);
 * the platform only owns the connection. Query typing comes from the table
 * passed to `select()`/`insert()`, not from a central schema registry.
 */
export type DB = PostgresJsDatabase<Record<string, never>>;

export interface DBHandle {
  db: DB;
  sql: postgres.Sql;
  end(): Promise<void>;
}

export const DBKey = Symbol("DB");

export async function createDB(cfg: Config): Promise<DBHandle> {
  const connectionString = dbConnString(cfg);

  const sql = postgres(connectionString, {
    max: cfg.db.max_conns,
    idle_timeout: cfg.db.max_conn_idle,
    connect_timeout: cfg.db.connect_timeout,
    max_lifetime: cfg.db.max_conn_life,
    ssl:
      cfg.db.ssl_mode === "disable"
        ? false
        : cfg.db.ssl_mode === "prefer" || cfg.db.ssl_mode === "require"
          ? cfg.db.ssl_mode
          : {
              rejectUnauthorized:
                cfg.db.ssl_mode === "verify-ca" || cfg.db.ssl_mode === "verify-full",
            },
  });

  const db: DB = drizzle(sql);

  try {
    await sql`SELECT 1`;
  } catch (err) {
    await sql.end();
    throw new Error(`ping db: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  return {
    db,
    sql,
    end: () => sql.end(),
  };
}
