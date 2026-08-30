// STUB FEATURE — delete src/features/example to start your project.

/**
 * Use-case orchestration for the example feature: validates input, applies
 * the domain entity, persists via the outbound port, and maps results to the
 * wire contract. Depends only on `domain`, `port`, and `contract`.
 */
import type { CreateItemRequest, ItemResponse } from "../contract/create-item.ts";
import type { ListItemsRequest, ListItemsResponse } from "../contract/list-items.ts";
import { ErrInvalidName } from "../domain/errors.ts";
import type { Item } from "../domain/item.ts";
import type { ItemRepository } from "../port/repository.ts";
import type { ItemService } from "./service.ts";

/** Map a domain entity to its wire representation (RFC3339 timestamps). */
function toItemResponse(item: Item): ItemResponse {
  return {
    id: item.id,
    name: item.name,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}

export interface ItemServiceLimits {
  defaultPageSize: number;
  maxPageSize: number;
  maxNameLength: number;
}

export class ItemUsecase implements ItemService {
  constructor(
    private readonly repo: ItemRepository,
    readonly limits: ItemServiceLimits,
  ) {}

  async create(req: CreateItemRequest): Promise<ItemResponse> {
    const name = req.name.trim();
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
    return toItemResponse(item);
  }

  async get(id: string): Promise<ItemResponse> {
    return toItemResponse(await this.repo.getById(id));
  }

  async list(req: ListItemsRequest): Promise<ListItemsResponse> {
    let { limit = 0, offset = 0 } = req;
    // An unset/zero limit (i.e. no query parameter) never produces LIMIT 0.
    if (limit <= 0) {
      limit = this.limits.defaultPageSize;
    }
    if (limit > this.limits.maxPageSize) {
      limit = this.limits.maxPageSize;
    }
    if (offset < 0) {
      offset = 0;
    }
    const items = await this.repo.list(limit, offset);
    return { items: items.map(toItemResponse) };
  }
}
