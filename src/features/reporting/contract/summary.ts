/**
 * Canonical inbound wire types for the reporting feature's `/api/v1`
 * endpoints. This module is the single source of truth for the HTTP JSON
 * shapes; the published facade `src/index.ts` re-exports the schemas and types
 * so other services can construct payloads without importing server
 * internals. Keep it free of domain imports -- wire concerns only (enforced by
 * `src/architecture.test.ts`).
 */
import { z } from "zod";

/**
 * SummaryRequest carries the top-machines parameter for GET /reports/summary.
 * It is bound from the GET query string; an absent parameter falls through to
 * the configured default, while an explicit value must be a non-negative
 * integer. The upper bound is deployment-configurable and enforced in the
 * usecase layer, so it is not encoded here.
 */
export const SummaryRequest = z.object({
  top: z.number().int().min(0).optional(),
});

/** CatalogStats is the catalog table's contribution to the report. */
export const CatalogStats = z.object({
  product_count: z.number().int(),
  total_stock: z.number().int(),
});

/** MachineStats is the machines table's contribution to the report. */
export const MachineStats = z.object({
  machine_count: z.number().int(),
  total_coin_bank_cents: z.number().int(),
});

/** SalesStats is the sales table's contribution to the report. */
export const SalesStats = z.object({
  purchase_count: z.number().int(),
  revenue_cents: z.number().int(),
});

/** MachineSales is one machine's sales aggregate in the leaderboard. */
export const MachineSales = z.object({
  machine_id: z.string(),
  label: z.string(),
  purchase_count: z.number().int(),
  revenue_cents: z.number().int(),
});

/**
 * SummaryResponse is the cross-feature report: one block per source table plus
 * the top machines by revenue.
 */
export const SummaryResponse = z.object({
  catalog: CatalogStats,
  machines: MachineStats,
  sales: SalesStats,
  top_machines: z.array(MachineSales),
});

export type SummaryRequest = z.infer<typeof SummaryRequest>;
export type CatalogStats = z.infer<typeof CatalogStats>;
export type MachineStats = z.infer<typeof MachineStats>;
export type SalesStats = z.infer<typeof SalesStats>;
export type MachineSales = z.infer<typeof MachineSales>;
export type SummaryResponse = z.infer<typeof SummaryResponse>;
