/**
 * Canonical inbound wire types for the machines feature's `/api/v1` endpoints.
 *
 * This module is the single source of truth for the HTTP JSON shapes; the
 * published facade `src/index.ts` re-exports the schemas and types so other
 * services can construct payloads without importing server internals. Keep it
 * free of domain imports — wire concerns only (enforced by
 * `src/architecture.test.ts`).
 */
import { z } from "zod";

export const CreateMachineRequest = z.object({
  // No hardcoded max — the usecase-level `max_label_length` config is the
  // real authority. The 4096 ceiling is a generous safety guard only.
  label: z.string().min(1).max(4096),
  // Accepted coin denominations are a domain fact enforced by the usecase
  // layer, so only the structural constraint (positive integers) lives here.
  initial_coins: z.array(z.number().int().positive()).optional(),
});

/**
 * MachineResponse is the JSON representation of a machine and its coin bank.
 * CoinBank keys are denomination values in cents, rendered as JSON object keys
 * (strings), so `coin_bank` is a JSON object rather than an array.
 */
export const MachineResponse = z.object({
  id: z.string(),
  label: z.string(),
  coin_bank: z.record(z.string(), z.number()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateMachineRequest = z.infer<typeof CreateMachineRequest>;
export type MachineResponse = z.infer<typeof MachineResponse>;
