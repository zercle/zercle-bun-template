// STUB FEATURE — delete src/features/example to start your project.

/**
 * Canonical inbound wire types for the example feature's `/api/v1` endpoints.
 *
 * This module is the single source of truth for the HTTP JSON shapes; the
 * published facade `src/index.ts` re-exports the schemas and types so other
 * services can construct payloads without importing server internals. Keep
 * it free of domain imports — wire concerns only (enforced by
 * `src/architecture.test.ts`).
 */
import { z } from "zod";

export const CreateItemRequest = z.object({
  // No hardcoded max — the application-level `max_name_length` config is the
  // real authority. The 4096 ceiling is a generous safety guard only.
  name: z.string().min(1).max(4096),
});

export const ItemResponse = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateItemRequest = z.infer<typeof CreateItemRequest>;
export type ItemResponse = z.infer<typeof ItemResponse>;
