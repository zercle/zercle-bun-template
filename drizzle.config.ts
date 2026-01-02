import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./src/infrastructure/db/drizzle.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/postgres",
  },
} satisfies Config;
