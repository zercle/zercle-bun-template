// STUB FEATURE — delete src/features/example to start your project.

/**
 * Inbound (driving) port of the example feature.
 *
 * Driving adapters under `adapter/in` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * adapters never touch the domain directly.
 */
import type { CreateItemRequest, ItemResponse } from "../contract/create-item.ts";
import type { ListItemsRequest, ListItemsResponse } from "../contract/list-items.ts";

export interface ItemService {
  create(req: CreateItemRequest): Promise<ItemResponse>;
  get(id: string): Promise<ItemResponse>;
  list(req: ListItemsRequest): Promise<ListItemsResponse>;
}
