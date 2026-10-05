/**
 * Published inbound contract of the service.
 *
 * This module is the facade over the canonical wire types owned by each
 * feature's `contract/` package, plus the wire error codes. Other services
 * may import from this package entry to construct request payloads, parse
 * responses, and interpret the error envelope — without depending on server
 * internals. Mirrors the Go template's `pkg/api/v1` facade.
 *
 * Internal code must NOT import this module; the dependency is strictly
 * outward-only and enforced by `src/architecture.test.ts`. A future v2
 * contract is a new facade module, not a change here.
 *
 * `AppType` is the type of the Hono app with all three demo features' `/api/v1`
 * routes mounted, for fully type-safe RPC via `hono/client`:
 *
 *   import { hc } from "hono/client";
 *   import type { AppType } from "zercle-bun-template";
 *   const client = hc<AppType>("http://localhost:8080");
 *   const res = await client.api.v1.products.$post({ json: { name: "x", price_cents: 75 } });
 *   await client.api.v1.machines.$get();
 *   await client.api.v1.purchases.$post({ json: { machine_id, product_id, coins: [100] } });
 *
 * Construction note: each `create*Router` only registers routes (no I/O at
 * construction time), so stub services are passed purely to capture the route
 * types. Do NOT call methods on the stubs at runtime.
 *
 * Health/liveness/metrics routes (`/healthz`, `/readyz`, `/metrics`) are
 * mounted directly on the runtime app in `src/infrastructure/server/http.ts` and
 * are not included in `AppType`. Clients that need to hit them can call
 * `fetch(base + "/healthz")` directly.
 */
import { Hono } from "hono";
import { createCatalogRouter } from "./features/catalog/handler/handler.ts";
import type { ProductService } from "./features/catalog/usecase/service.ts";
import { createMachinesRouter } from "./features/machines/handler/handler.ts";
import type { MachineService } from "./features/machines/usecase/service.ts";
import { createSalesRouter } from "./features/sales/handler/handler.ts";
import type { SalesService } from "./features/sales/usecase/service.ts";

// --- Catalog feature wire contract (v1) -------------------------------------

export {
  CreateProductRequest,
  ProductResponse,
} from "./features/catalog/contract/create-product.ts";
export {
  ListProductsRequest,
  ListProductsResponse,
} from "./features/catalog/contract/list-products.ts";

// --- Machines feature wire contract (v1) ------------------------------------

export {
  CreateMachineRequest,
  MachineResponse,
} from "./features/machines/contract/create-machine.ts";
export {
  ListMachinesRequest,
  ListMachinesResponse,
  RestockBankRequest,
} from "./features/machines/contract/list-machines.ts";

// --- Sales feature wire contract (v1) ---------------------------------------

export { PurchaseRequest, PurchaseResponse } from "./features/sales/contract/purchase.ts";

// --- Wire error codes -------------------------------------------------------

export {
  ErrCodeCanceled,
  ErrCodeConflict,
  ErrCodeDeadlineExceeded,
  ErrCodeForbidden,
  ErrCodeInternal,
  ErrCodeInvalidInput,
  ErrCodeNotFound,
  ErrCodeUnauthorized,
} from "./infrastructure/errors/errcodes.ts";

// --- Type-safe RPC surface ---------------------------------------------------

const _typeApp = new Hono()
  .route("/api/v1", createCatalogRouter({ service: {} as ProductService }))
  .route("/api/v1", createMachinesRouter({ service: {} as MachineService }))
  .route("/api/v1", createSalesRouter({ service: {} as SalesService }));

export type AppType = typeof _typeApp;
