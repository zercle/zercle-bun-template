import type { Checker } from "../telemetry/health";
import type { DBHandle } from "./db";

export function postgresChecker(handle: DBHandle): Checker {
  return {
    name: "postgres",
    check: async () => {
      await handle.sql`SELECT 1`;
    },
  };
}
