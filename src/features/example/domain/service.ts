// STUB FEATURE — delete src/features/example to start your project.
import type { Item } from "./item.ts";

export interface ItemService {
  create(name: string): Promise<Item>;
  get(id: string): Promise<Item>;
  list(limit: number, offset: number): Promise<Item[]>;
}
