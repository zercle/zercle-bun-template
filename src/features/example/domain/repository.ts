// STUB FEATURE — delete src/features/example to start your project.
import type { Item } from "./item.ts";

export interface ItemRepository {
  create(item: Item): Promise<Item>;
  getById(id: string): Promise<Item>;
  list(limit: number, offset: number): Promise<Item[]>;
}
