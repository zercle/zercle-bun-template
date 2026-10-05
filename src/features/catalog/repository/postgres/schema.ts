/**
 * Drizzle table definitions owned by this feature's postgres adapter. The
 * column layout mirrors the feature's migration SQL under `migrations/`;
 * schema is owned by the migration, never by `AutoMigrate`-style tooling.
 */
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const catalogProducts = pgTable("catalog_products", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type NewProductRow = typeof catalogProducts.$inferInsert;
