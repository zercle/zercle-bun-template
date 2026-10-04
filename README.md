# zercle-bun-template

Opinionated Bun + Hono + TypeScript HTTP service template: clean (DDD) architecture, an eager-singleton DI container, OpenTelemetry tracing, Prometheus metrics, PostgreSQL via Drizzle, and a Valkey cache-aside example — with three layered features (catalog, machines, sales) forming a small distributed-vending-machines demo to copy or delete.

## Prerequisites

- Bun 1.4+
- Docker/Podman
- PostgreSQL 18+ (via container)
- Valkey 9+ (via container)

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres valkey
bun install
bun run migrate:up
bun run dev
```

The server listens on `0.0.0.0:8080` (configured under `http.host` / `http.port` in `config.yaml`, overridable with `HTTP_HOST` / `HTTP_PORT`). Health probes: `/healthz`, `/readyz`, `/metrics`.

## Directory tree

```
zercle-bun-template/
├── .github/
│   ├── dependabot.yml
│   └── workflows/              # ci.yml (lint/unit/integration/build), cd.yml, security.yml
├── deployments/
│   ├── kustomize/
│   │   ├── base/               # deployment, service, configmap, secret, kustomization
│   │   └── overlays/development/
│   └── observability/          # otel-collector-config.yaml, prometheus.yml
├── src/
│   ├── main.ts                 # entry point: loads config, delegates to src/app
│   ├── index.ts                # published inbound contract facade (outward-only)
│   ├── migrate.ts              # self-contained migration runner (up / down / status)
│   ├── architecture.test.ts    # executable dependency gates (runs in bun run test)
│   ├── app/                    # reusable composition root (Container, build, run)
│   ├── config/                 # YAML + env-var configuration loader
│   ├── features/
│   │   ├── features.ts         # feature registry: the single enumeration point
│   │   ├── catalog/            # global product pool (price + stock)
│   │   ├── machines/           # vending machines + their coin banks
│   │   └── sales/              # purchases: price a sale, compose change, commit
│   │       # catalog, machines, and sales each repeat the same slice layout below:
│   │       ├── contract/       # canonical inbound wire types (zod) — dependency-free leaf
│   │       ├── domain/         # entities + sentinel errors
│   │       ├── port/           # outbound (driven) interface
│   │       ├── application/    # inbound port interface + use-case orchestration
│   │       ├── adapter/
│   │       │   ├── in/http/    # driving adapter: Hono handler
│   │       │   └── out/postgres/  # driven adapter: Drizzle repository + schema + migrations
│   │       └── di.ts           # feature wiring
│   └── platform/               # cross-cutting, feature-agnostic infrastructure
│       ├── server/             # Hono app + Application lifecycle
│       ├── middleware/         # requestId, otel, accessLog, recover, cors, bodyLimit
│       ├── telemetry/          # logger, tracer, meter, health registry
│       ├── errors/             # error codes, AppError, sentinels, HTTP mapper
│       ├── db/                 # connection-level Drizzle/postgres wiring (schema-free)
│       └── messaging/          # Valkey (ioredis) + cache-aside
├── test/
│   └── e2e/                    # end-to-end tests (bun run test:e2e)
├── .editorconfig
├── .env.example
├── compose.yml                 # postgres + valkey + migrate + server
├── config.yaml
├── Containerfile
├── Containerfile.migrate
├── drizzle.config.ts
├── LICENSE
├── package.json
├── README.md
└── tsconfig.json
```

## Architecture overview

The template follows **clean (DDD) architecture** inside each feature, with all dependencies pointing inward:

```
consumer services ──> src/index.ts ──> features/*/contract    (published contract, outward-only)
adapter/in ──> application.Service ──> port.Repository <── adapter/out/postgres
all layers ──> domain (entities + sentinel errors)
platform/* ── cross-cutting, never imports features/**
```

- `contract` holds the canonical inbound wire types (zod schemas, no feature imports) — the single source of the API shapes.
- `domain` holds entities, value objects, and sentinel errors.
- `port` declares the outbound (driven) interface; `adapter/out/postgres` satisfies it with Drizzle over the `postgres` driver and owns the table schema and SQL migrations.
- `application` declares the inbound service interface (speaking contract types) and its use-case implementation.
- `adapter/in/http` is the driving adapter: the Hono handler parses contract types and delegates to the application service.
- `platform` consolidates cross-cutting concerns: config, db pool, valkey, cache-aside, typed errors, middleware, server, telemetry.

**Published inbound contract.** `src/index.ts` is the facade over each feature's `contract` types plus the wire error codes, so another service can construct payloads and interpret the `{"error": code, "message": msg}` envelope without importing server internals. Internal code never imports `src/index.ts`; the dependency is strictly outward-only and enforced by `src/architecture.test.ts`.

**Executable dependency gates.** `src/architecture.test.ts` scans the import specifiers of every non-test source file under `src/` and fails when a layer reaches sideways or outward: facade outward-only, domain purity, contract leaf purity, the port and application allowlists, adapter separation, and platform's feature-agnosticism. It runs as part of `bun run test`.

Composition uses a small **eager-singleton DI container** (`src/app/container.ts`). `src/app/app.ts` is the reusable composition root that wires the container in dependency order:

```
config → telemetry → db → valkey → server → features
```

`src/main.ts` is a thin entry point that reads build-time metadata (`APP_VERSION` / `APP_COMMIT_SHA` / `APP_BUILD_TIME`) and calls `run`, which installs SIGTERM/SIGINT handlers and starts `Bun.serve`.

The registry is the **single enumeration point**: `features` in `src/features/features.ts` holds one `Feature` (`name`, `register`, `migrationsDir`) per feature, `registerAll` wires the container, and `migrationSources()` feeds the migration runner. Adding or deleting a feature is therefore one entry in that list plus the feature's own directory. That order is also the migration order: `catalog` owns schema version 1, `machines` version 2, `sales` version 3.

**Migrations are feature-owned**: each feature's SQL lives in its `adapter/out/postgres/migrations/`, and `src/migrate.ts` merges every registered feature's migrations via `migrationSources()`, so deleting a feature deletes its schema with it. `bun run migrate:up` / `migrate:down` / `migrate:status` drive the self-contained runner (`up` applies every pending migration in one transaction each, `down` steps down exactly one version, `status` prints per-feature applied/pending counts). Version numbers are a **single namespace across all features**, not per feature: the next migration added to any feature takes the next free version. Author one with `FEATURE=<name> bun run migrate:generate`, which runs `drizzle-kit` against that feature's `schema.ts` and writes into its migrations directory; renumber the generated file to the next free global version. `drizzle-kit` only generates `*.up.sql`, so the matching `*.down.sql` files are hand-written, and `down` exits non-zero when one is missing rather than silently diverging.

Configuration is loaded from `config.yaml` and the environment (env wins) into a typed, validated `Config` via Zod. `CATALOG_ENABLED`, `MACHINES_ENABLED`, and `SALES_ENABLED` gate each feature: when false its providers, routes, and sentinel mappings are not registered at all. Name/label and page-size limits (`CATALOG_MAX_NAME_LENGTH`, `CATALOG_MAX_PAGE_SIZE`, `MACHINES_MAX_LABEL_LENGTH`, `MACHINES_MAX_PAGE_SIZE`) are enforced in the application layer, so a deployment can raise them without touching request validation. See the [Configuration reference](#configuration-reference).

### Routes

| Method | Path | Feature | Purpose |
|---|---|---|---|
| POST | `/api/v1/products` | catalog | add a product to the global pool |
| GET | `/api/v1/products` | catalog | list products (paginated) |
| GET | `/api/v1/products/:id` | catalog | fetch one product |
| POST | `/api/v1/machines` | machines | register a machine with an initial coin bank |
| GET | `/api/v1/machines` | machines | list machines (paginated) |
| GET | `/api/v1/machines/:id` | machines | fetch one machine |
| POST | `/api/v1/machines/:id/bank` | machines | restock a machine's coin bank |
| POST | `/api/v1/purchases` | sales | buy a product: price, compose change, commit |

Health and observability endpoints (`/healthz`, `/readyz`, `/metrics`) are served by `src/platform/server`.

**Cross-feature boundaries.** Features never import each other; each owns its domain, contract, and repository port. `sales` consumes catalog and machines data only through its own `port.Repository`, whose postgres implementation reads the `catalog_products` and `machines` tables directly and commits the sale in one transaction. This is a deliberate single-database compromise — the tables are shared, but the port is the seam: a future service split replaces that one implementation without touching the sales domain or application layer. Stock is a **global pool** (decrementing a product affects every machine), while per-machine product slots are the documented extension if the demo grows.

Every HTTP failure — handler errors and framework errors (404/405, body-limit 413) alike — is served in the `{"error": code, "message": msg}` envelope, with codes exported from `src/index.ts`.

## Caching (Valkey cache-aside)

`src/platform/messaging/cache-aside.ts` adds cache-aside reads on top of the Valkey (Redis-compatible) client: `CacheAside.get(key, loader)` runs the loader on a miss while concurrent misses for the same key share one in-flight promise, then stores the result with `SET ... EX ttl`. A loader error propagates to every waiter and is not cached, so the next `get` retries. Invalidation on write is explicit via `del`. The catalog feature's `CachedProductRepository` decorates the Drizzle repository with it, so the application layer stays cache-unaware. `VALKEY_TTL` sets the entry lifetime.

## Type-safe client & published contract

`src/index.ts` re-exports the wire request/response schemas for all three features, the error codes, and the `AppType` of the Hono app with the `/api/v1` routes mounted. Downstream services import from the package entry without touching server internals, and can drive a fully typed RPC client via `hono/client`. Health and metrics routes are mounted directly on the runtime app and are not part of `AppType`; reach them with plain `fetch`.

```ts
import { hc } from "hono/client";
import { ErrCodeNotFound, type AppType } from "zercle-bun-template";

const client = hc<AppType>("http://localhost:8080");

// machineId / productId are ids returned by the machines and products calls.
const res = await client.api.v1.products.$post({
  json: { name: "cola", price_cents: 75, stock: 10 },
});
const list = await client.api.v1.products.$get({ query: { limit: 10, offset: 0 } });
const purchase = await client.api.v1.purchases.$post({
  json: { machine_id: machineId, product_id: productId, coins: [100] },
});
if (res.status === 404) {
  // body.error === ErrCodeNotFound
}
```

## Adding and deleting features

To add a feature:

1. Copy or author `src/features/<name>/` (the slice layout described above).
2. Add one entry to `features` in `src/features/features.ts` — `name`, `register`, and `migrationsDir` when it owns schema. Migrations are numbered in one global namespace, so take the next free version across all features.
3. Register its config in `src/config/config.ts` and add its re-exports in `src/index.ts` before publishing.

To replace the demo features (catalog, machines, sales):

1. Remove the feature directories under `src/features/` you are replacing.
2. Remove their entries from `features` in `src/features/features.ts`.
3. Replace their re-exports in `src/index.ts` with your feature's contract types.
4. Delete the `catalog:` / `machines:` / `sales:` blocks from `config.yaml` and the matching `CATALOG_*` / `MACHINES_*` / `SALES_*` lines from `.env.example`.

## Scripts

All scripts are defined in `package.json` and run via `bun run <name>`.

| Script | Purpose |
|---|---|
| `dev` | Start the server with file watching |
| `start` | Start the server without watching |
| `typecheck` | Type-check the project |
| `lint` / `lint:fix` / `format` | Biome checks / auto-fixes / formatting |
| `test` / `test:unit` | Unit tests (includes the architecture gates) |
| `test:integration` | Integration tests (`*.integration.test.ts`) |
| `test:e2e` | End-to-end tests (`test/e2e/**`) |
| `test:coverage` | Unit tests with v8 coverage (60% thresholds) |
| `migrate:up` / `migrate:down` / `migrate:status` | Run the migration runner |
| `migrate:generate` | Author a migration with drizzle-kit into `FEATURE`'s directory |
| `docker:build` | Build the server container image |

## Testing

Vitest is configured with three projects in `vitest.config.ts`:

- `unit` — `src/**/*.test.ts` (also the default for `bun run test`), including `src/architecture.test.ts`.
- `integration` — `src/**/*.integration.test.ts`, against live PostgreSQL + Valkey.
- `e2e` — `test/e2e/**/*.test.ts`, booting the full composition root against live dependencies.

```bash
bun run test                # unit tests (no external services)
bun run test:integration    # requires postgres + valkey
bun run test:e2e            # requires postgres + valkey
bun run test:coverage       # unit tests + coverage
```

## Configuration reference

`config.yaml` holds the defaults; `.env.example` lists the environment overrides (env wins over YAML). Durations accept Go-style values such as `15s`, `30m`, `1h`; `http.body_limit` accepts size suffixes such as `1M`.

| Section | Env vars |
|---|---|
| `app` | `APP_NAME`, `APP_ENVIRONMENT`, `APP_HOST`, `APP_PORT`, `APP_SHUTDOWN_TIMEOUT` |
| `http` | `HTTP_HOST`, `HTTP_PORT`, `HTTP_READ_TIMEOUT`, `HTTP_WRITE_TIMEOUT`, `HTTP_IDLE_TIMEOUT`, `HTTP_BODY_LIMIT`, `HTTP_HEALTH_PROBE_TIMEOUT`, `HTTP_CORS_ALLOW_ORIGINS`, `HTTP_CORS_ALLOW_METHODS`, `HTTP_CORS_ALLOW_HEADERS` |
| `db` | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL_MODE`, `DB_MAX_CONNS`, `DB_MIN_CONNS`, `DB_MAX_CONN_IDLE`, `DB_MAX_CONN_LIFE`, `DB_CONNECT_TIMEOUT` |
| `valkey` | `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_DB`, `VALKEY_CONNECT_TIMEOUT`, `VALKEY_TTL` |
| `otel` | `OTEL_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_TRACES_SAMPLER_ARG` |
| `log` | `LOG_LEVEL`, `LOG_FORMAT` |
| `catalog` | `CATALOG_ENABLED`, `CATALOG_DEFAULT_PAGE_SIZE`, `CATALOG_MAX_PAGE_SIZE`, `CATALOG_MAX_NAME_LENGTH` |
| `machines` | `MACHINES_ENABLED`, `MACHINES_DEFAULT_PAGE_SIZE`, `MACHINES_MAX_PAGE_SIZE`, `MACHINES_MAX_LABEL_LENGTH` |
| `sales` | `SALES_ENABLED` |

`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_TRACES_SAMPLER_ARG` map to `otel.endpoint` and `otel.sampling` respectively; the endpoint is required when `OTEL_EXPORTER=otlp`.

## Deployment

- `Containerfile` builds a multi-stage distroless/non-root server image (`bun build --compile`, no `node_modules` in the final layer).
- `compose.yml` runs postgres, valkey, migrate, and server locally; the `observability` profile adds OTel Collector, Prometheus, and Grafana (`docker compose --profile observability up`).
- `Containerfile.migrate` builds the migration image the `migrate` service runs before `server` starts.
- `.github/workflows/cd.yml` publishes multi-arch (`amd64`/`arm64`) server and migrate images to ghcr.io on a `v*` tag.
- Kustomize manifests live under `deployments/kustomize/` (a `base` plus a `development` overlay); observability config is under `deployments/observability/`.
- Release automation beyond `cd.yml` is intentionally omitted; add it per project.

## License

See [LICENSE](LICENSE).
