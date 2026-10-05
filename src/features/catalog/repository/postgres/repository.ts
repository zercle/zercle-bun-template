/**
 * Driven adapter: Drizzle/Postgres persistence for `Product` entities.
 * Satisfies the feature's `ProductRepository` interface structurally and translates
 * between storage rows and domain entities.
 */
import { desc, eq } from "drizzle-orm";
import type { DB } from "../../../../infrastructure/db/index.ts";
import { ErrProductNotFound } from "../../domain/errors.ts";
import type { Product } from "../../domain/product.ts";
import type { ProductRepository } from "../repository.ts";
import { catalogProducts, type NewProductRow } from "./schema.ts";

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: DB) {}

  async create(product: Product): Promise<Product> {
    const row: NewProductRow = {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      stock: product.stock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
    await this.db.insert(catalogProducts).values(row);
    return product;
  }

  async getById(id: string): Promise<Product> {
    const rows = await this.db
      .select()
      .from(catalogProducts)
      .where(eq(catalogProducts.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw ErrProductNotFound;
    }
    return {
      id: row.id,
      name: row.name,
      priceCents: row.priceCents,
      stock: row.stock,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Ordered by created_at descending, then by id descending to keep order
  // stable across pages with identical timestamps.
  async list(limit: number, offset: number): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(catalogProducts)
      .orderBy(desc(catalogProducts.createdAt), desc(catalogProducts.id))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.priceCents,
      stock: row.stock,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
