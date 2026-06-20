// STUB FEATURE — delete src/features/example to start your project.
import { z } from "zod";
import type { Item } from "../domain/item.ts";

export const CreateItemRequest = z.object({
  name: z.string().min(1).max(255),
});

export const ItemResponse = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateItemRequest = z.infer<typeof CreateItemRequest>;
export type ItemResponse = z.infer<typeof ItemResponse>;

export function toItemResponse(item: Item): ItemResponse {
  return {
    id: item.id,
    name: item.name,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}
