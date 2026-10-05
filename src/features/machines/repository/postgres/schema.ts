/**
 * Drizzle table definitions owned by this feature's postgres adapter.
 * `drizzle-kit` reads this file (see `drizzle.config.ts`) and writes the
 * generated SQL migrations to the top-level `migrations/` folder.
 *
 * The `coin_bank` JSONB column stores JSON object keys as strings, so the
 * boundary helpers below convert between the domain's numeric-keyed `CoinBank`
 * and the string-keyed JSON representation.
 */
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { CoinBank } from "../../domain/machine.ts";

export const machines = pgTable("machines", {
  id: uuid("id").primaryKey(),
  label: text("label").notNull(),
  coinBank: jsonb("coin_bank").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type NewMachineRow = typeof machines.$inferInsert;

/** Convert a domain bank to its JSONB representation (string keys). */
export function bankToJson(bank: CoinBank): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [denomination, count] of Object.entries(bank)) {
    out[denomination] = count;
  }
  return out;
}

/** Convert a JSONB bank (string keys) back to the domain representation. */
export function bankFromJson(json: Record<string, number>): CoinBank {
  const out: Record<number, number> = {};
  for (const [denomination, count] of Object.entries(json)) {
    out[Number(denomination)] = count;
  }
  return out;
}
