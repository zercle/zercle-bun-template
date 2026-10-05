/**
 * Sample catalog products for tests. Mirrors the Go template's
 * `internal/testutil/fixtures/products.go`: deterministic ids and fixed
 * timestamps so suites assert against known values instead of `now()`.
 */
import type { Product } from "../../features/catalog/domain/product.ts";

/** Fixed timestamp every fixture is stamped with (Go: 2026-01-01 UTC). */
export const FIXTURE_TIME = new Date("2026-01-01T00:00:00.000Z");

/** Default deterministic product id, mirroring Go's fixed fixture UUID. */
export const FIXED_PRODUCT_ID = "22345678-1234-1234-1234-123456789abc";

/**
 * Build a catalog product with fixed timestamps. `id` defaults to the fixed
 * fixture id; pass a distinct id when a single test needs several rows.
 */
export function newProduct(
  name: string,
  priceCents: number,
  stock: number,
  id: string = FIXED_PRODUCT_ID,
): Product {
  return { id, name, priceCents, stock, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME };
}
