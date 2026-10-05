/**
 * Outbound (driven) port of the reporting feature. The usecase layer
 * consumes this interface; the Drizzle adapter under `repository/postgres`
 * satisfies it structurally.
 *
 * The reporting feature reads the catalog, machines, and sales tables through
 * its own port rather than calling the other features' usecases. That is the
 * same deliberate single-database compromise the sales feature documents: the
 * tables are shared, but this port is the seam where a future service split
 * replaces the implementation without touching the reporting domain or
 * usecase.
 */
import type { MachineSales, Overview } from "../domain/summary.ts";

export interface ReportingRepository {
  /**
   * Returns the cross-feature totals in one round trip. A read-only aggregate
   * over empty tables yields a zero-value Overview, not an error.
   */
  getOverview(): Promise<Overview>;
  /**
   * Returns up to `limit` machines ranked by revenue (then purchase count,
   * then id) with their purchase rollup. It never reports a not-found: a
   * machine with no sales has no leaderboard row.
   */
  getTopMachines(limit: number): Promise<MachineSales[]>;
}
