// STUB FEATURE — delete src/features/example to start your project.

/**
 * Outbound (driven) port of the example feature: persistence of `Item`
 * entities. The application layer consumes this interface; the Drizzle
 * adapter under `adapter/out/postgres` satisfies it structurally.
 */
import type { Item } from "../domain/item.ts";

export interface ItemRepository {
  create(item: Item): Promise<Item>;
  getById(id: string): Promise<Item>;
  list(limit: number, offset: number): Promise<Item[]>;
}
