# Repository Guidelines

Repo-specific guidance for AI coding agents working in `zercle-bun-template`.

`README.md` holds the architecture rationale and the feature add/replace checklist. `package.json`, `biome.json`, `vitest.config.ts`, and `.github/workflows/ci.yml` are the executable source of truth — verify anything here against them.

## Project Overview

An opinionated **Bun + Hono + TypeScript HTTP service template**: clean (DDD) architecture per feature, an eager-singleton DI container, Drizzle over the `postgres` driver, an ioredis Valkey cache-aside example, pino logging, and OpenTelemetry tracing + prom-client metrics. Four layered features form a **distributed-vending-machines demo** — `catalog` (global product pool), `machines` (vending machines + coin banks), `sales` (purchases), and read-only `reporting` (cross-feature summary) — meant to be copied or replaced; see README §"Adding and deleting features".

Consumers (other TypeScript services) import only `src/index.ts`, the published facade over each feature's contract plus the wire error codes; it also exports `AppType` for a fully typed `hono/client` RPC client. Internal code never imports the facade, and that is enforced by an executable test.

## Architecture & Data Flow

Clean (DDD) architecture **per feature**, all dependencies pointing inward. The direction is **enforced by an executable test**, not convention alone (`src/architecture.test.ts`, runs in `bun run test`).

```
consumer services ──> src/index.ts ──> features/*/contract    (published contract, outward-only)
handler ──> usecase.Service ──> repository.Repository <── repository/postgres
all layers ──> domain (entities + sentinel errors; no src or third-party imports)
infrastructure/* ── feature-agnostic, never imports features/**
```

A request flows: `src/main.ts` (thin entry; reads `APP_VERSION`/`APP_COMMIT_SHA`/`APP_BUILD_TIME`, calls `run`) → `src/app/app.ts` `run` builds a `Container` and calls `build`, which wires in fixed order — `loadConfig` (register `Config`) → `telemetry` (logger, tracer, meter, health registry) → `db` → `valkey` → `server` (Hono app + `Application`) → `features` (via `registerAll`) → `Application.start()` calls `Bun.serve`. A feature `register` resolves its deps from the container, mounts its router at `/api/v1`, and the `handler` binds the zod `contract`, calls the `usecase.Service`, which parses ids, applies business rules, and maps domain↔contract → `repository.Repository` (Drizzle) behind an optional `CachedRepository` decorator (catalog's cache-aside; other features use the Drizzle repository directly) → domain sentinel errors are mapped to the HTTP envelope by `infrastructure/errors` (`registerSentinel` + `httpError`).

**Dependency gates** — `src/architecture.test.ts` scans the import specifiers of every non-test source file under `src/` across 9 rules; a violation fails with the rule name and rationale. If a change trips a rule, **restructure the change — never weaken the rule**:

| Rule | Forbids |
|---|---|
| `published-facade-is-outward-only` | any internal file importing `src/index.ts` |
| `domain-is-innermost` | anything but its own `features/<f>/domain` (no bare packages) |
| `contract-is-leaf` | anything but `zod` and its own `features/<f>/contract` |
| `repository-interface-depends-only-on-domain` | the top-level `repository` module importing outside its own `domain`/sibling repository modules |
| `usecase-depends-on-domain-repository-contract` | `features/<f>/usecase` importing outside its own `domain`, top-level `repository`, `contract`, and sibling usecase modules |
| `repository-impl-ignores-usecase-and-handler` | `repository/postgres/**` importing its own `usecase` or `handler` |
| `handler-ignores-repository` | `features/<f>/handler` importing its own `repository` |
| `features-registry-imports-only-own-features` | the registry importing bare packages or relative paths outside `app/container` and `features/**` |
| `infrastructure-ignores-features` | `infrastructure/**` importing `features/**` |

## Key Directories

- `src/main.ts` — thin process entry point (build metadata, delegates to `src/app/app.ts`).
- `src/migrate.ts` — self-contained migration runner (`up`/`down`/`status`); merges every registered feature's migrations via `migrationSources()` into one global version namespace.
- `src/index.ts` — published inbound facade (contract re-exports + error codes + `AppType`); outward-only.
- `src/app/` — reusable composition root: `container.ts` (eager-singleton DI) and `app.ts` (`build`/`run`).
- `src/architecture.test.ts` — the 9 dependency gates (source of truth for layering).
- `src/features/features.ts` — the feature registry: `features`, `registerAll`, `migrationSources`. Its order is also the migration order (catalog 1, machines 2, sales 3; reporting owns no schema and no `migrationsDir`).
- `src/features/{catalog,machines,sales,reporting}/` — the four demo features. Layers, each its own directory: `contract` (zod wire types, zero deps), `domain` (entities + sentinels), `usecase` (`Service` interface + implementation), `repository` (outbound interface) and `repository/postgres/` (Drizzle impl + `schema.ts` + `migrations/`, plus catalog's cache-aside decorator), `handler` (Hono), `di.ts` (wiring). Features never import each other; `sales` and `reporting` read the other features' tables through their own repository ports.
- `src/infrastructure/` — cross-cutting: `config`, `db`, `messaging` (Valkey + cache-aside), `errors`, `middleware`, `server`, `telemetry`.
- `src/testutil/` — shared integration helpers (`newIntegrationDB`, `truncateTables`) + fixtures.
- `test/e2e/` — end-to-end tests.

## Development Commands

Bun is the runner — prefer `bun run <script>` (scripts live in `package.json`) over ad-hoc invocations:

- `bun run dev` / `bun run start` — run the server with file watching / once.
- `bun run typecheck` — `tsc --noEmit`.
- `bun run lint` / `lint:fix` / `format` — Biome check / check+write / format.
- `bun run test` (alias `test:unit`) — unit suite (includes the architecture gates).
- `bun run test:integration` — needs live PostgreSQL + Valkey.
- `bun run test:e2e` — boots the full server; skips when `DB_HOST`/`VALKEY_HOST` are unset.
- `bun run test:coverage` — unit suite with v8 coverage (60% thresholds).
- `bun run migrate:up` / `migrate:down` / `migrate:status` — drive the self-contained runner (`up` applies every pending migration one transaction each, `down` steps down exactly one version, `status` prints per-feature applied/pending counts). The runner loads `config.yaml` + env and exits non-zero when PostgreSQL is unreachable.
- `FEATURE=<name> bun run migrate:generate` — author a migration with drizzle-kit against that feature's `schema.ts`, written into its `migrations/` directory; `FEATURE` is required.
- `bun run docker:build` — build the server container image.

Local services: `docker compose up -d postgres valkey` (`compose.yml` uses `postgres:18-alpine` and `valkey:9-alpine`).

## Code Conventions & Common Patterns

- **Naming.** Layer directories are fixed lowercase nouns (`contract`, `domain`, `usecase`, `repository`, `handler`). Interfaces are named by role, not feature: `usecase.Service` (inbound), `repository.Repository` (outbound). Impls: `Usecase`, `Drizzle*Repository`, `CachedRepository` (decorator), `Handler`/`create*Router`. Every feature exposes one `register(container)` entry in `di.ts`. Files are kebab-case (`.ts`); imports carry the explicit `.ts` extension (Bun/TS `allowImportingTsExtensions`).
- **DI.** `Container` is an eager singleton: `register(key, factory)` invokes the factory immediately and stores the value; keys are `Symbol("Name")` exported by the owning module. `build` wires in a fixed order and `resolve` throws on a missing key, so registration-order mistakes fail fast.
- **Error handling.** Three tiers: (1) **domain sentinels** — package-level `Err*` `Error` objects in `features/*/domain/errors.ts`; (2) **boundary sentinels** — `AppError` values in `infrastructure/errors/app-error.ts` (`ErrNotFound`, `ErrInvalidInput`, `ErrInternal`, …), codes from `infrastructure/errors/errcodes.ts` so served and published codes cannot drift; (3) **registration** — features call `registerSentinel(domain.ErrX, ErrY)` in `di.ts`, and handlers map any error via `httpError(err)` into `{status, body}`. The envelope is always `{"error": code, "message": msg}`.
- **Config.** Loaded from `config.yaml` + unprefixed env vars (env wins) and validated by one zod schema in `src/infrastructure/config/config.ts`; `CONFIG_FILE` overrides the path. Durations accept `15s`/`30m`/`1h` and are stored as seconds; `http.body_limit` accepts `1M`-style sizes. Cross-section checks (e.g. reporting bounds) fail startup. `CATALOG_ENABLED` / `MACHINES_ENABLED` / `SALES_ENABLED` / `REPORTING_ENABLED` gate each demo feature's providers and routes entirely.
- **Persistence.** Each feature owns its Drizzle table definitions in `repository/postgres/schema.ts` and its SQL migrations under `repository/postgres/migrations/`. The schema is owned by the migration, never by `AutoMigrate`-style tooling. `reporting` owns no schema: it declares read-only table projections in `refs.ts` (NOT `schema.ts`) so `drizzle-kit` never emits DDL for other features' tables.
- **Formatting:** Biome — double quotes, 2-space indent, semicolons, trailing commas, 100-column lines, organized imports (`.editorconfig` mirrors the layout: LF, final newline).
- Mocks are inline: `vi.fn`/`vi.mock` and hand-written fakes in the test file. There is no generated-mock layer (Go's `mockgen` has no equivalent).

## Testing & QA

- **Frameworks.** Vitest with **three projects** (`vitest.config.ts`) instead of Go build tags: `unit` (`src/**/*.test.ts`, the default for `bun run test`, includes `src/architecture.test.ts`), `integration` (`src/**/*.integration.test.ts`, live PostgreSQL + Valkey), and `e2e` (`test/e2e/**/*.test.ts`, boots the full composition root as a subprocess). `passWithNoTests` is on.
- **Architecture gate.** `bunx vitest run --project unit src/architecture.test.ts` — run after any refactor that moves imports or layers.
- **Integration.** No testcontainers: suites use `src/testutil/` (`newIntegrationDB` applies migrations from the one merged `migrationSources()` and holds a PostgreSQL session advisory lock so suites sharing the database serialize; `truncateTables` resets state between cases). They hard-fail when infra is missing and refuse `APP_ENVIRONMENT=production`.
- **E2E.** `test/e2e/server.e2e.test.ts` spawns `bun run src/main.ts` as a child on `127.0.0.1:8091` (a developer's dev server on 8080 is undisturbed) and drives it over HTTP; it skips cleanly when `DB_HOST`/`VALKEY_HOST` are unset. The reporting case asserts the cross-feature summary after the product/machine/purchase cases and the `top=-1` 400 envelope.
- **Coverage.** 60% thresholds (lines/functions/branches/statements) enforced by `bun run test:coverage`, which CI runs.
- **CI.** `.github/workflows/ci.yml`: `lint` → `unit` (60% gate, Codecov, coverage artifact) → `integration` (postgres + Valkey service containers) → `build` (both container images); `lint` fails on `bun.lock` drift. `security.yml` runs a weekly Trivy filesystem scan + `bun audit`; `cd.yml` publishes multi-arch server and migrate images to ghcr.io on a `v*` tag.

## Gotchas

- `drizzle-kit` only generates `*.up.sql`, so the matching `*.down.sql` files are hand-written; `migrate down` exits non-zero when one is missing rather than silently diverging. `migrate down` steps down exactly one version.
- Migration versions are **one global namespace across all features**, not per feature: the next migration added to any feature takes the next free version, and two files claiming a version is a hard error.
- Deleting a feature means removing its directory **and** its entry in `src/features/features.ts` **and** its re-exports in `src/index.ts` **and** its `config.yaml` / `.env.example` blocks. Dropping the registry entry drops its migrations with it.
- `bun run test` is hermetic; `test:integration` and `test:e2e` need live services. Only the e2e suite skips on missing `DB_HOST`/`VALKEY_HOST` — integration hard-fails.
- `AppType` covers the `/api/v1` feature routes only; `/healthz`, `/readyz`, and `/metrics` are mounted on the runtime app and must be reached with plain `fetch`.
