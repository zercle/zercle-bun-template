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
 * `AppType` is the type of the Hono app with the `/api/v1` example routes
 * mounted, for fully type-safe RPC via `hono/client`:
 *
 *   import { hc } from "hono/client";
 *   import type { AppType } from "zercle-bun-template";
 *   const client = hc<AppType>("http://localhost:8080");
 *   const res = await client.api.v1.items.$post({ json: { name: "x" } });
 *
 * Construction note: `createExampleRouter` only registers routes (no I/O at
 * construction time), so a stub `ItemService` is passed purely to capture
 * the route type. Do NOT call methods on the stub at runtime.
 *
 * Health/liveness/metrics routes (`/healthz`, `/readyz`, `/metrics`) are
 * mounted directly on the runtime app in `src/platform/server/http.ts` and
 * are not included in `AppType`. Clients that need to hit them can call
 * `fetch(base + "/healthz")` directly.
 */
import { Hono } from "hono";
import { createExampleRouter } from "./features/example/adapter/in/http/handler.ts";
import type { ItemService } from "./features/example/application/service.ts";

// --- Example feature wire contract (v1) -------------------------------------

export { CreateItemRequest, ItemResponse } from "./features/example/contract/create-item.ts";
export { ListItemsRequest, ListItemsResponse } from "./features/example/contract/list-items.ts";

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
} from "./platform/errors/errcodes.ts";

// --- Type-safe RPC surface ---------------------------------------------------

const _typeApp = new Hono().route("/api/v1", createExampleRouter({ service: {} as ItemService }));

export type AppType = typeof _typeApp;
