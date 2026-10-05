/**
 * Reporting feature domain types. This feature owns no schema: `Overview` and
 * `MachineSales` are read-only projections aggregated from the catalog,
 * machines, and sales tables, never persisted.
 */

/**
 * Overview is the reporting feature's cross-feature aggregate: one read of
 * totals from the catalog, machines, and sales tables. A zero-valued Overview
 * is the empty-database report, so an absent table contributes zero rather
 * than an error.
 */
export interface Overview {
  productCount: number;
  totalStock: number;
  machineCount: number;
  totalBankCents: number;
  purchaseCount: number;
  revenueCents: number;
}

/**
 * MachineSales is one machine's sales rollup for the top-machines leaderboard.
 * It carries only the fields a report reads; it is a projection, not the
 * machines feature's entity.
 */
export interface MachineSales {
  machineId: string;
  label: string;
  purchaseCount: number;
  revenueCents: number;
}
