// STUB FEATURE — delete src/features/example to start your project.
import { ErrInvalidName } from "../domain/errors.ts";
import type { Item } from "../domain/item.ts";
import type { ItemRepository } from "../domain/repository.ts";
import type { ItemService } from "../domain/service.ts";

export interface ItemServiceLimits {
  defaultPageSize: number;
  maxPageSize: number;
  maxNameLength: number;
}

export class ItemServiceImpl implements ItemService {
  constructor(
    private readonly repo: ItemRepository,
    private readonly limits: ItemServiceLimits,
  ) {}

  async create(name: string): Promise<Item> {
    name = name.trim();
    // Count by Unicode code points (matches Go's utf8.RuneCountInString).
    // `name.length` would count UTF-16 code units and split surrogate pairs.
    const codePointCount = [...name].length;
    if (codePointCount === 0 || codePointCount > this.limits.maxNameLength) {
      throw ErrInvalidName;
    }
    const now = new Date();
    const item: Item = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(item);
    return item;
  }

  async get(id: string): Promise<Item> {
    return this.repo.getById(id);
  }

  async list(limit: number, offset: number): Promise<Item[]> {
    if (limit <= 0) limit = this.limits.defaultPageSize;
    if (limit > this.limits.maxPageSize) limit = this.limits.maxPageSize;
    if (offset < 0) offset = 0;
    return this.repo.list(limit, offset);
  }
}
