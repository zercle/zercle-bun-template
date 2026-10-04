/**
 * Drizzle table definitions owned by this feature's postgres adapter.
 * `drizzle-kit` reads this file (see `drizzle.config.ts`) and writes the
 * generated SQL migrations to the top-level `migrations/` folder.
 *
 * Only tables this feature OWNS belong here; projections onto other features'
 * tables live in `refs.ts` so no DDL is generated for them.
 */
import { integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const salesPurchases = pgTable("sales_purchases", {
  id: uuid("id").primaryKey(),
  machineId: uuid("machine_id").notNull(),
  productId: uuid("product_id").notNull(),
  priceCents: integer("price_cents").notNull(),
  totalInsertedCents: integer("total_inserted_cents").notNull(),
  changeCents: integer("change_cents").notNull(),
  changeCoins: jsonb("change_coins").$type<number[]>().notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type NewPurchaseRow = typeof salesPurchases.$inferInsert;
