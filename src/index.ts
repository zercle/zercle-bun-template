/**
 * Public type surface of the service.
 *
 * `AppType` is the type of the Hono app with the `/api/v1` example routes
 * mounted. Consumers can use it with `hono/client` for fully type-safe RPC:
 *
 *   import { hc } from "hono/client";
 *   import type { AppType } from "zercle-bun-template";
 *   const client = hc<AppType>("http://localhost:8080");
 *   const res = await client.api.v1.items.$post({ json: { name: "x" } });
 *
 * Construction note: `createExampleRouter` only registers routes (no I/O at
 * construction time), so we can pass a stub `ItemService` purely to capture
 * the route type. Do NOT call methods on the stub at runtime.
 *
 * Health/liveness/metrics routes (`/healthz`, `/readyz`, `/metrics`) are
 * mounted directly on the runtime app in `src/shared/server/http.ts` and are
 * not included in `AppType`. Clients that need to hit them can call
 * `fetch(base + "/healthz")` directly.
 */
import { Hono } from "hono";
import type { ItemService } from "./features/example/domain/service.ts";
import { createExampleRouter } from "./features/example/handler/http.ts";

const _typeApp = new Hono().route("/api/v1", createExampleRouter({ service: {} as ItemService }));

export type AppType = typeof _typeApp;
