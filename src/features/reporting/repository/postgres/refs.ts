/**
 * Read-only projections over tables owned by other features
 * (`catalog_products`, `machines`, `sales_purchases`). This is a deliberate
 * single-database compromise: reporting answers cross-feature questions with
 * one aggregate read, so it reaches those tables directly through its own port
 * rather than calling the other features' usecases. In a truly distributed
 * deployment this becomes cross-service calls or a read model, and this port
 * is already the seam where that swap happens. The reporting feature
 * deliberately declares its own row shapes instead of importing the catalog,
 * machines, or sales packages, so no feature depends on another feature's
 * persistence internals.
 *
 * The reporting feature owns no schema and never writes, so these refs live in
 * `refs.ts`, NOT `schema.ts`: `drizzle-kit generate --schema .../schema.ts`
 * never emits DDL for other features' tables.
 */
import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

/** Projects the `catalog_products` columns the summary aggregates. */
export const catalogProductsRef = pgTable("catalog_products", {
  id: uuid("id").primaryKey(),
  stock: integer("stock").notNull(),
});

/** Projects the `machines` columns the summary aggregates. */
export const machinesRef = pgTable("machines", {
  id: uuid("id").primaryKey(),
  label: text("label").notNull(),
  coinBank: jsonb("coin_bank").$type<Record<string, number>>().notNull(),
});

/** Projects the `sales_purchases` columns the summary aggregates. */
export const salesPurchasesRef = pgTable("sales_purchases", {
  id: uuid("id").primaryKey(),
  machineId: uuid("machine_id").notNull(),
  priceCents: integer("price_cents").notNull(),
});
