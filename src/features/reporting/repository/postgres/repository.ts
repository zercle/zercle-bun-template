/**
 * Driven adapter: Drizzle/Postgres reads for the reporting feature. Satisfies
 * the feature's `ReportingRepository` interface structurally. It owns no schema and
 * never writes; it aggregates the catalog, machines, and sales tables through
 * the read-only projections in `refs.ts`.
 *
 * Postgres returns `COUNT`/`SUM` (bigint) as strings through postgres-js, so
 * every aggregate is coerced with `Number()` at the boundary.
 */
import { sql } from "drizzle-orm";
import type { DB } from "../../../../infrastructure/db/index.ts";
import type { MachineSales, Overview } from "../../domain/summary.ts";
import type { ReportingRepository } from "../repository.ts";
import { catalogProductsRef, machinesRef, salesPurchasesRef } from "./refs.ts";

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export class DrizzleReportingRepository implements ReportingRepository {
  constructor(private readonly db: DB) {}

  /**
   * Computes every cross-feature total in one round trip using scalar
   * subqueries, so the report is a single statement over the three tables.
   *
   * The coin-bank subquery sums denomination times count: machines stores
   * `coin_bank` as a JSON object keyed by denomination in cents
   * (`{"5":10,"25":4}`), not as an array, so `jsonb_each_text` is the shape
   * that yields total cents (`jsonb_array_elements_text` rejects an object).
   * An empty database yields a zero-value Overview, never a not-found.
   */
  async getOverview(): Promise<Overview> {
    try {
      const rows = await this.db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM ${catalogProductsRef}) AS product_count,
          (SELECT COALESCE(SUM(stock), 0) FROM ${catalogProductsRef}) AS total_stock,
          (SELECT COUNT(*) FROM ${machinesRef}) AS machine_count,
          (SELECT COALESCE(SUM(b.key::bigint * b.value::bigint), 0)
             FROM ${machinesRef} m, jsonb_each_text(m.coin_bank) AS b(key, value)) AS total_bank_cents,
          (SELECT COUNT(*) FROM ${salesPurchasesRef}) AS purchase_count,
          (SELECT COALESCE(SUM(price_cents), 0) FROM ${salesPurchasesRef}) AS revenue_cents
      `);
      const row = rows[0];
      if (row === undefined) {
        return {
          productCount: 0,
          totalStock: 0,
          machineCount: 0,
          totalBankCents: 0,
          purchaseCount: 0,
          revenueCents: 0,
        };
      }
      return {
        productCount: toNumber(row.product_count),
        totalStock: toNumber(row.total_stock),
        machineCount: toNumber(row.machine_count),
        totalBankCents: toNumber(row.total_bank_cents),
        purchaseCount: toNumber(row.purchase_count),
        revenueCents: toNumber(row.revenue_cents),
      };
    } catch (err) {
      throw new Error("get overview", { cause: err });
    }
  }

  /**
   * Ranks machines by revenue and purchase count. The join is inner, so a
   * machine with no sales has no leaderboard row. The trailing m.id tie-break
   * makes the order deterministic when revenue and count are equal.
   */
  async getTopMachines(limit: number): Promise<MachineSales[]> {
    try {
      const rows = await this.db.execute(sql`
        SELECT m.id AS machine_id, m.label AS label, COUNT(p.id) AS purchase_count, COALESCE(SUM(p.price_cents), 0) AS revenue_cents
        FROM ${machinesRef} m
        JOIN ${salesPurchasesRef} p ON p.machine_id = m.id
        GROUP BY m.id, m.label
        ORDER BY revenue_cents DESC, purchase_count DESC, m.id
        LIMIT ${limit}
      `);
      return rows.map((row) => ({
        machineId: String(row.machine_id),
        label: String(row.label),
        purchaseCount: toNumber(row.purchase_count),
        revenueCents: toNumber(row.revenue_cents),
      }));
    } catch (err) {
      throw new Error("get top machines", { cause: err });
    }
  }
}
