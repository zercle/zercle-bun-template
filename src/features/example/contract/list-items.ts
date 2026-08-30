// STUB FEATURE — delete src/features/example to start your project.

/**
 * Pagination wire types for `GET /api/v1/items`. See `create-item.ts` for
 * the contract-module ground rules.
 */
import { z } from "zod";
import { ItemResponse } from "./create-item.ts";

export const ListItemsRequest = z.object({
  limit: z.number().int().min(0).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ListItemsResponse = z.object({
  items: z.array(ItemResponse),
});

export type ListItemsRequest = z.infer<typeof ListItemsRequest>;
export type ListItemsResponse = z.infer<typeof ListItemsResponse>;
