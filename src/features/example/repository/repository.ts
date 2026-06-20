// STUB FEATURE — delete src/features/example to start your project.
import { desc, eq } from "drizzle-orm";
import { type DB, items, type NewItemRow } from "../../../infrastructure/db/index.ts";
import { ErrItemNotFound } from "../domain/errors.ts";
import type { Item } from "../domain/item.ts";
import type { ItemRepository } from "../domain/repository.ts";

export class DrizzleItemRepository implements ItemRepository {
  constructor(private readonly db: DB) {}

  async create(item: Item): Promise<Item> {
    const row: NewItemRow = {
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
    await this.db.insert(items).values(row);
    return item;
  }

  async getById(id: string): Promise<Item> {
    const rows = await this.db.select().from(items).where(eq(items.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw ErrItemNotFound;
    }
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(limit: number, offset: number): Promise<Item[]> {
    const rows = await this.db
      .select()
      .from(items)
      .orderBy(desc(items.createdAt), desc(items.id))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
