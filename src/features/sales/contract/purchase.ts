/**
 * Canonical inbound wire types for the sales feature's `/api/v1` endpoints.
 *
 * This module is the single source of truth for the HTTP JSON shapes; the
 * published facade `src/index.ts` re-exports the schemas and types so other
 * services can construct payloads without importing server internals. Keep
 * it free of domain imports — wire concerns only (enforced by
 * `src/architecture.test.ts`).
 */
import { z } from "zod";

/**
 * Hyphenated UUID shape, mirroring Go's `validate:"uuid"` (and the example
 * feature's `UUID_RE`). Deliberately looser than zod's `z.uuid()`, which also
 * enforces RFC 4122 variant bits and would reject ids the Go contract accepts.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PurchaseRequest is the payload for buying a product: the machine, the
 * product, and the coins inserted. Coins are validated structurally (at least
 * one, positive); the domain layer rejects values that are not accepted
 * denominations because the accepted set is a domain fact, not a wire fact.
 */
export const PurchaseRequest = z.object({
  machine_id: z.string().regex(UUID_RE, "invalid uuid"),
  product_id: z.string().regex(UUID_RE, "invalid uuid"),
  coins: z.array(z.number().int().positive()).min(1),
});

/** PurchaseResponse is the JSON representation of a completed purchase. */
export const PurchaseResponse = z.object({
  id: z.string(),
  machine_id: z.string(),
  product_id: z.string(),
  price_cents: z.number().int(),
  total_inserted_cents: z.number().int(),
  change_cents: z.number().int(),
  change_coins: z.array(z.number().int()),
  purchased_at: z.string(),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequest>;
export type PurchaseResponse = z.infer<typeof PurchaseResponse>;
