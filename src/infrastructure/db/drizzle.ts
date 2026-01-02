import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"),
  due_date: timestamp("due_date"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Types for tables
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  dbname: string;
  max_conns: number;
  min_conns: number;
  max_conn_lifetime: string;
  max_conn_idletime: string;
  health_check_period: string;
}

export class DrizzleDatabase {
  private client: postgres.Sql;
  public db: ReturnType<typeof drizzle>;

  constructor(config: DatabaseConfig) {
    const connectionString = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.dbname}`;

    this.client = postgres(connectionString, {
      max: config.max_conns,
      min: config.min_conns,
      idle_timeout: parseDuration(config.max_conn_idletime),
      connect_timeout: parseDuration(config.max_conn_lifetime),
      max_lifetime: parseDuration(config.max_conn_lifetime),
    });

    this.db = drizzle(this.client);
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) {
    return 60000; // default 1 minute
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    default:
      return 60000;
  }
}
