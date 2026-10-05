/**
 * Use-case orchestration for the catalog feature: validates input, applies
 * the domain entity, persists via the outbound repository, and maps results to the
 * wire contract. Depends only on `domain`, `repository`, and `contract`.
 */
import type { CreateProductRequest, ProductResponse } from "../contract/create-product.ts";
import type { ListProductsRequest, ListProductsResponse } from "../contract/list-products.ts";
import { ErrInvalidPrice, ErrInvalidProductName } from "../domain/errors.ts";
import type { Product } from "../domain/product.ts";
import type { ProductRepository } from "../repository/repository.ts";
import type { ProductService } from "./service.ts";

/** Fallback bounds, mirroring the Go template's package-level defaults. */
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_NAME_LENGTH = 255;

/** Map a domain entity to its wire representation (RFC3339 timestamps). */
function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    price_cents: product.priceCents,
    stock: product.stock,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}

export interface ProductServiceLimits {
  defaultPageSize: number;
  maxPageSize: number;
  maxNameLength: number;
}

export class ProductUsecase implements ProductService {
  private readonly repo: ProductRepository;
  readonly limits: ProductServiceLimits;

  /**
   * Bounds <= 0 fall back to the built-in defaults (20/100/255), mirroring
   * the Go template's `NewUsecase`.
   */
  constructor(repo: ProductRepository, limits: ProductServiceLimits) {
    this.repo = repo;
    this.limits = {
      defaultPageSize: limits.defaultPageSize > 0 ? limits.defaultPageSize : DEFAULT_PAGE_SIZE,
      maxPageSize: limits.maxPageSize > 0 ? limits.maxPageSize : MAX_PAGE_SIZE,
      maxNameLength: limits.maxNameLength > 0 ? limits.maxNameLength : MAX_NAME_LENGTH,
    };
  }

  async create(req: CreateProductRequest): Promise<ProductResponse> {
    const name = req.name.trim();
    // Count by Unicode code points (matches Go's utf8.RuneCountInString).
    // `name.length` would count UTF-16 code units and split surrogate pairs.
    const codePointCount = [...name].length;
    if (codePointCount === 0 || codePointCount > this.limits.maxNameLength) {
      throw ErrInvalidProductName;
    }
    if (req.price_cents <= 0) {
      throw ErrInvalidPrice;
    }
    const now = new Date();
    const product: Product = {
      id: crypto.randomUUID(),
      name,
      priceCents: req.price_cents,
      stock: req.stock,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(product);
    return toProductResponse(product);
  }

  async get(id: string): Promise<ProductResponse> {
    return toProductResponse(await this.repo.getById(id));
  }

  async list(req: ListProductsRequest): Promise<ListProductsResponse> {
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
    const products = await this.repo.list(limit, offset);
    return { products: products.map(toProductResponse) };
  }
}
