import type { Checker } from "../../shared/telemetry/health";
import type { DBHandle } from "./db";

export function postgresChecker(handle: DBHandle): Checker {
  return {
    name: "postgres",
    check: async () => {
      await handle.sql`SELECT 1`;
    },
  };
}
