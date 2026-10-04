/**
 * Inbound (driving) port of the catalog feature.
 *
 * Driving adapters under `adapter/in` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * adapters never touch the domain directly.
 */
import type { CreateProductRequest, ProductResponse } from "../contract/create-product.ts";
import type { ListProductsRequest, ListProductsResponse } from "../contract/list-products.ts";

export interface ProductService {
  create(req: CreateProductRequest): Promise<ProductResponse>;
  get(id: string): Promise<ProductResponse>;
  list(req: ListProductsRequest): Promise<ListProductsResponse>;
}
