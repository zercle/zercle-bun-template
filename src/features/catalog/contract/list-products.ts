/**
 * Pagination wire types for `GET /api/v1/products`. See `create-product.ts`
 * for the contract-module ground rules.
 */
import { z } from "zod";
import { ProductResponse } from "./create-product.ts";

export const ListProductsRequest = z.object({
  // No hardcoded max — the usecase layer clamps to the configurable
  // `max_page_size`, so a cap here would drift from the deployment setting.
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional(),
});

export const ListProductsResponse = z.object({
  products: z.array(ProductResponse),
});

export type ListProductsRequest = z.infer<typeof ListProductsRequest>;
export type ListProductsResponse = z.infer<typeof ListProductsResponse>;
