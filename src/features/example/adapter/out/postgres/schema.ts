// STUB FEATURE — delete src/features/example to start your project.

/**
 * Drizzle table definitions owned by this feature's postgres adapter.
 * `drizzle-kit` reads this file (see `drizzle.config.ts`) and writes the
 * generated SQL migrations to the top-level `migrations/` folder.
 */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type NewItemRow = typeof items.$inferInsert;
