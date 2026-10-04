/**
 * Outbound (driven) port of the catalog feature: persistence of `Product`
 * entities. The application layer consumes this interface; the Drizzle
 * adapter under `adapter/out/postgres` satisfies it structurally.
 */
import type { Product } from "../domain/product.ts";

export interface ProductRepository {
  create(product: Product): Promise<Product>;
  getById(id: string): Promise<Product>;
  list(limit: number, offset: number): Promise<Product[]>;
}
