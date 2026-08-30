# zercle-bun-template

A Bun + Hono + TypeScript backend service template with a clean (DDD) architecture, DI-container-based wiring, Postgres (Drizzle ORM), Valkey (Redis-compatible) caching, OpenTelemetry traces, Prometheus metrics, and a Docker Compose stack including an optional observability profile.

## Features

- Bun runtime, Hono 4 HTTP framework
- Clean (DDD) architecture: feature slices over `contract` / `domain` / `port` / `application` / `adapter`, with the dependency rule enforced by an executable architecture test (`src/architecture.test.ts`)
- Exposed inbound type contract: wire schemas and error codes re-exported from the package entry (`src/index.ts`) for downstream consumers
- Composition root in `src/main.ts` -> `src/app/app.ts`, with SIGTERM/SIGINT graceful shutdown
- Postgres via `pg` and Drizzle ORM 0.45 (`drizzle-kit` migrations)
- Valkey (Redis-compatible) via `ioredis`
- Zod 4 request/response validation
- Pino structured logging (JSON or pretty)
- OpenTelemetry SDK with OTLP HTTP trace exporter and HTTP instrumentation
- Prometheus metrics via `prom-client`
- Liveness and readiness probes backed by a pluggable health registry
- Vitest 4 with `unit`, `integration`, and `e2e` projects, v8 coverage
- Biome 2 for lint and format
- Containerfile + multi-service `compose.yml` with an `observability` profile (OTel Collector, Prometheus, Grafana)
- Type-safe RPC client via `hono/client` and the exported `AppType`

## Prerequisites

- Bun >= 1.3.0 (the project pins `bun@1.3.2` via `packageManager`)
- Docker and Docker Compose (optional; only needed for Postgres/Valkey via containers or the observability stack)

## Quick start

```bash
# 1. Copy environment defaults
cp .env.example .env

# 2. Install dependencies
bun install

# 3. Start Postgres and Valkey via Compose
docker compose up -d postgres valkey

# 4. Apply database migrations
bun run migrate:up

# 5. Start the server in watch mode
bun run dev
```

The server listens on `http://0.0.0.0:8080` by default (configured under `http.host` / `http.port` in `config.yaml`, overridable with `HTTP_HOST` / `HTTP_PORT`).

## Project structure

Clean architecture with dependencies pointing inward: `adapter/in` → `application` → `port` + `domain`; `adapter/out` satisfies ports; `platform` is feature-agnostic. The rules are executable — `src/architecture.test.ts` fails the unit suite on any violation.

```text
src/
  main.ts                Composition root entry point
  index.ts               Published inbound contract facade (wire types, error codes, AppType)
  architecture.test.ts   Executable dependency-rule gates
  app/                   Application wiring (container, build, run)
  config/                YAML + env-var configuration loader
  features/              Feature slices
    example/             STUB feature demonstrating the pattern; delete to start
      contract/          Inbound wire types (zod schemas) — the dependency-free leaf
      domain/            Entities + domain logic + sentinel errors
      port/              Outbound (driven) port interfaces
      application/       Inbound port interface + use-case orchestration
      adapter/
        in/http/         Driving adapter: HTTP handler
        out/postgres/    Driven adapter: Drizzle repository + table schema
      di.ts              Feature composition (wires adapters to ports)
  platform/              Cross-cutting, feature-agnostic infrastructure
    server/              Hono app + Application lifecycle
    middleware/          requestId, recover, otel, accessLog, cors, bodyLimit
    telemetry/           logger, tracer, meter, health registry
    errors/              error codes, AppError, sentinels, HTTP error mapper
    db/                  Connection-level Drizzle/postgres wiring (schema-free)
    messaging/           Valkey (ioredis) wiring
  migrate.ts             Migration CLI (up / down / status)
```

Dependency rules enforced by `src/architecture.test.ts` (mirroring the Go template's `internal/architecture_test.go`):

1. `domain` depends on nothing
2. `contract` is a dependency-free leaf (`zod` only) and is published outward only through `src/index.ts`
3. `port` references only its own feature's `domain`
4. `application` orchestrates its own feature's `domain`, `port`, and `contract`
5. `adapter/out` never imports `application` or `adapter/in`
6. `adapter/in` talks to the application port only — never to `port` or `adapter/out`
7. `platform` never imports `features`
8. internal code never imports the `src/index.ts` facade (outward-only)

New features copy the same slice shape; add each feature's `adapter/out/postgres/schema.ts` to `drizzle.config.ts`.

The middleware stack is registered in this fixed order in `src/platform/server/http.ts`:

1. `requestId`
2. `recover`
3. `otel`
4. `accessLog`
5. `cors`
6. `bodyLimit` (only when `http.body_limit` parses to a positive size)

## Configuration

Two equivalent sources are merged at startup, with environment variables taking precedence over YAML:

- `config.yaml` — default values, organised into sections: `app`, `http`, `db`, `valkey`, `log`, `otel`, `example`.
- `.env.example` — environment variable names accepted as overrides (`APP_*`, `HTTP_*`, `DB_*`, `VALKEY_*`, `LOG_*`, `OTEL_*`, `EXAMPLE_*`). Copy this file to `.env` and edit as needed.

Durations accept Go-style values such as `15s`, `30m`, `1h`. `http.body_limit` accepts size suffixes such as `1M`.

## HTTP API

### Observability (mounted on the root app)

| Method | Path       | Description                                          | Success | Failure |
| ------ | ---------- | ---------------------------------------------------- | ------- | ------- |
| GET    | `/healthz` | Liveness probe                                       | 200     | 500     |
| GET    | `/readyz`  | Readiness probe; runs the health registry            | 200     | 503     |
| GET    | `/metrics` | Prometheus metrics scrape endpoint                   | 200     | -       |

### Example stub feature (mounted at `/api/v1`)

The `src/features/example` slice is a deliberately minimal CRUD stub that demonstrates the clean-architecture pattern (contract, domain, port, application, adapter, di). **Delete `src/features/example` to start a real project.**

| Method | Path                   | Description                                          | Success |
| ------ | ---------------------- | ---------------------------------------------------- | ------- |
| POST   | `/api/v1/items`        | Create an item; body `{ "name": string }`            | 201     |
| GET    | `/api/v1/items`        | List items; query `limit`, `offset`                  | 200     |
| GET    | `/api/v1/items/:id`    | Fetch an item by UUID                                | 200     |

## Type-safe client & published contract

`src/index.ts` is the published inbound contract facade (mirroring the Go template's `pkg/api/v1`): it re-exports the wire request/response schemas, the error codes carried in the `{"error", "message"}` envelope, and the `AppType` of the Hono app with the `/api/v1` routes mounted. Downstream services import from the package entry without touching server internals. Use `AppType` with `hono/client` for a fully typed RPC client. Health and metrics routes are mounted directly on the runtime app and are not part of `AppType`; reach them with plain `fetch`.

```ts
import { hc } from "hono/client";
import { ErrCodeNotFound, type ItemResponse, ListItemsResponse } from "zercle-bun-template";
import type { AppType } from "zercle-bun-template";

const client = hc<AppType>("http://localhost:8080");

const res = await client.api.v1.items.$post({ json: { name: "x" } });
const list = await client.api.v1.items.$get({ query: { limit: 10, offset: 0 } });
const parsed = ListItemsResponse.safeParse(await list.json());
if (res.status === 404) {
  // body.error === ErrCodeNotFound
}
```

## Scripts

All scripts are defined in `package.json` and run via `bun run <name>` (or `npm run <name>`).

| Script               | Command                                                  | Purpose                                                  |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `dev`                | `bun run --watch src/main.ts`                            | Start the server with file watching                      |
| `start`              | `bun run src/main.ts`                                    | Start the server without watching                        |
| `typecheck`          | `tsc --noEmit`                                           | Type-check the project                                   |
| `lint`               | `biome check src test`                                   | Run Biome checks                                         |
| `lint:fix`           | `biome check --write src test`                           | Apply Biome auto-fixes                                   |
| `format`             | `biome format --write src test`                          | Format with Biome                                        |
| `test`               | `vitest run --project unit`                              | Run the unit test project                                |
| `test:unit`          | `vitest run --project unit`                              | Unit tests only                                          |
| `test:integration`   | `vitest run --project integration`                      | Integration tests (`*.integration.test.ts`)              |
| `test:e2e`           | `vitest run --project e2e`                              | End-to-end tests (`test/e2e/**`)                         |
| `test:coverage`      | `vitest run --project unit --coverage`                   | Unit tests with v8 coverage                              |
| `migrate:generate`   | `drizzle-kit generate`                                   | Generate a new SQL migration from the Drizzle schema     |
| `migrate:up`         | `bun run src/migrate.ts up`                              | Apply pending migrations                                 |
| `migrate:down`       | `bun run src/migrate.ts down`                            | Declared but not implemented by the runner (exits with usage error) |
| `migrate:status`     | `bun run src/migrate.ts status`                          | Show migration status                                    |
| `docker:build`       | `docker build -f Containerfile -t zercle-bun-template:latest .` | Build the server container image                  |

## Database migrations

Schema is managed with Drizzle. The configuration lives in `drizzle.config.ts`; generated SQL is written to `migrations/`.

```bash
# After editing src/features/example/adapter/out/postgres/schema.ts
bun run migrate:generate

# Apply pending migrations
bun run migrate:up

# Inspect applied vs pending migrations
bun run migrate:status
```

Only `up` and `status` are implemented by `src/migrate.ts`. The `down` subcommand is declared in `package.json` but not implemented — rollback is not currently supported.

The `migrate` service in `compose.yml` runs `migrate up` automatically (via the `Containerfile.migrate` entrypoint, which defaults to `up`) before the `server` service starts.

## Testing

Vitest is configured with three projects in `vitest.config.ts`:

- `unit` — `src/**/*.test.ts`, environment `node` (also the default for `bun run test`).
- `integration` — `src/**/*.integration.test.ts`, environment `node`.
- `e2e` — `test/e2e/**/*.test.ts`, environment `node`.

Coverage is provided by `@vitest/coverage-v8` with `text` and `lcov` reporters, scoped to `src/**/*.ts` (excluding `*.test.ts`, `*.integration.test.ts`, and `index.ts` barrels). Coverage thresholds are 60% for lines, functions, branches, and statements.

```bash
bun run test                # unit tests only
bun run test:integration
bun run test:e2e
bun run test:coverage       # unit tests + coverage
```

## Docker

Build the server image:

```bash
bun run docker:build
```

Or start the full stack (Postgres, Valkey, migrate, server):

```bash
docker compose up -d
```

The compose file declares these services:

- `postgres` (`postgres:18-alpine`) — port `5432`, named volume `postgres_data`
- `valkey` (`valkey:9-alpine`) — port `6379`, named volume `valkey_data`
- `migrate` — built from `Containerfile.migrate`, waits for Postgres to be healthy
- `server` — built from `Containerfile`, port `8080`, waits for Postgres and Valkey to be healthy and for `migrate` to complete successfully

All services share the `zercle-template` bridge network.

### Observability profile

Bring up the OTel Collector, Prometheus, and Grafana alongside the core stack:

```bash
docker compose --profile observability up
```

This adds:

- `otel-collector` (`otel/opentelemetry-collector-contrib:0.114.0`) — ports `4317` (OTLP gRPC), `4318` (OTLP HTTP), `8888`, `8889`
- `prometheus` (`prom/prometheus:v3.0.1`) — port `9090`, named volume `prometheus_data`
- `grafana` (`grafana/grafana:11.4.0`) — port `3000`, default credentials `admin` / `admin`, named volume `grafana_data`

Prometheus and Grafana configuration files are mounted from `deployments/observability/`.

## Observability

- **Traces** — OpenTelemetry SDK with the OTLP HTTP exporter. Configure the endpoint via `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`). Set `OTEL_EXPORTER=none` to disable export entirely.
- **Metrics** — `prom-client` registry exposed at `GET /metrics`.
- **Logs** — Pino structured logs. `LOG_LEVEL` (`debug` / `info` / `warn` / `error`) and `LOG_FORMAT` (`json` / `pretty`).
- **Probes** — `GET /healthz` runs the liveness checks, `GET /readyz` runs the readiness checks; both are bounded by `HTTP_HEALTH_PROBE_TIMEOUT`.

## CI/CD

GitHub Actions workflows live in `.github/workflows/` (mirroring the Go template's setup):

- **`ci.yml`** — on push/PR to `main`/`develop`: lint + typecheck, unit tests with coverage (60% thresholds enforced by vitest, report uploaded to Codecov and as an artifact), integration tests against service containers (Postgres + Valkey, migrations applied first), and a docker build of both images.
- **`cd.yml`** — on a `v*` tag push: builds multi-arch (`amd64`/`arm64`) server and migrate images and pushes them to `ghcr.io` (`:latest`, `:tag`, and `git describe` versions). Build metadata (`APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_TIME`) is stamped via `Containerfile` build args and printed by the server at startup.
- **`security.yml`** — weekly (Monday 06:00 UTC) or manual: Trivy filesystem scan uploaded to the GitHub Security tab, plus `bun audit --audit-level=low` against the committed lockfile.

Known-vulnerable transitive versions are pinned to patched releases via the `overrides` field in `package.json`; `dependabot.yml` keeps GitHub Actions, npm packages, and docker images current.

## License

See [LICENSE](LICENSE).
