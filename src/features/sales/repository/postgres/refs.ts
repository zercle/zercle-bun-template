/**
 * Read/write projections over tables owned by other features (`catalog_products`
 * and `machines`). This is a deliberate single-database compromise:
 * orchestrating a purchase needs to decrement stock and replace the coin bank
 * in the same transaction as the purchase insert, so the sales repository
 * reaches those tables directly through its own port rather than calling the
 * other features' usecases. In a truly distributed deployment this becomes
 * cross-service calls or a saga, and this port is already the seam where that
 * swap happens. The sales feature deliberately declares its own row shapes
 * instead of importing the catalog or machines packages, so no feature depends
 * on another feature's persistence internals.
 *
 * These refs exist ONLY for typed reads/writes through sales' own port, and
 * they live in `refs.ts`, NOT `schema.ts`, so `drizzle-kit generate
 * --schema .../schema.ts` never emits DDL for other features' tables.
 */
import { integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

/** Projects the `catalog_products` columns a purchase reads and decrements. */
export const catalogProductsRef = pgTable("catalog_products", {
  id: uuid("id").primaryKey(),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

/**
 * Projects the `machines` columns a purchase reads and updates. The `coin_bank`
 * jsonb column is keyed by the denomination as a string; the repository
 * converts it to and from the sales feature's own number-keyed `CoinBank`.
 */
export const machinesRef = pgTable("machines", {
  id: uuid("id").primaryKey(),
  coinBank: jsonb("coin_bank").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});
