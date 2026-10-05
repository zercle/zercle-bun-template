/**
 * Driven adapter: decorates a `ProductRepository` with cache-aside reads.
 * Satisfies the same interface, so the usecase layer is unaware of caching.
 *
 * Only `getById` is cached. `list` results are not, because a page depends on
 * the whole table's write history and a stale page would misreport global
 * stock. Mirrors the Go template's `CachedRepository`.
 */
import type { CacheAside } from "../../../../infrastructure/messaging/cache-aside.ts";
import type { Product } from "../../domain/product.ts";
import type { ProductRepository } from "../repository.ts";

/** Namespaces cache-aside keys for the catalog feature. */
const PRODUCT_CACHE_PREFIX = "catalog:product:";

/**
 * Wire shape stored in the cache. It is kept independent of the domain entity
 * so `Date` values survive the JSON round-trip the cache performs (the entity
 * holds `Date`, JSON holds strings).
 */
interface CachedProduct {
  id: string;
  name: string;
  price_cents: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

function toCachedProduct(product: Product): CachedProduct {
  return {
    id: product.id,
    name: product.name,
    price_cents: product.priceCents,
    stock: product.stock,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}

function fromCachedProduct(cached: CachedProduct): Product {
  return {
    id: cached.id,
    name: cached.name,
    priceCents: cached.price_cents,
    stock: cached.stock,
    createdAt: new Date(cached.created_at),
    updatedAt: new Date(cached.updated_at),
  };
}

export class CachedProductRepository implements ProductRepository {
  constructor(
    private readonly repo: ProductRepository,
    private readonly aside: CacheAside,
  ) {}

  // A newly created ID cannot have a cached entry, so no invalidation is
  // needed; list results are intentionally not cached.
  async create(product: Product): Promise<Product> {
    return this.repo.create(product);
  }

  async getById(id: string): Promise<Product> {
    const cached = await this.aside.get<CachedProduct>(PRODUCT_CACHE_PREFIX + id, async () =>
      toCachedProduct(await this.repo.getById(id)),
    );
    return fromCachedProduct(cached);
  }

  async list(limit: number, offset: number): Promise<Product[]> {
    return this.repo.list(limit, offset);
  }
}
