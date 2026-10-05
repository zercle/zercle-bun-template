/**
 * Canonical inbound wire types for the catalog feature's `/api/v1` endpoints.
 *
 * This module is the single source of truth for the HTTP JSON shapes; the
 * published facade `src/index.ts` re-exports the schemas and types so other
 * services can construct payloads without importing server internals. Keep
 * it free of domain imports — wire concerns only (enforced by
 * `src/architecture.test.ts`).
 */
import { z } from "zod";

export const CreateProductRequest = z.object({
  // No hardcoded max — the usecase-level `max_name_length` config is the
  // real authority. The 4096 ceiling is a generous safety guard only.
  name: z.string().min(1).max(4096),
  // Only structural constraints live here; the usecase layer enforces the
  // deployment-configurable bounds so a hardcoded cap cannot drift from them.
  price_cents: z.number().int().positive(),
  stock: z.number().int().min(0).default(0),
});

export const ProductResponse = z.object({
  id: z.string(),
  name: z.string(),
  price_cents: z.number(),
  stock: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateProductRequest = z.infer<typeof CreateProductRequest>;
export type ProductResponse = z.infer<typeof ProductResponse>;
