# zercle-bun-template

Opinionated Bun + Hono + TypeScript microservice template with clean architecture, hand-rolled DI, OpenTelemetry, Prometheus metrics, and an example CRUD feature ready to be deleted.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
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

The server listens on `0.0.0.0:8080` for HTTP.

## Directory tree

```
zercle-bun-template/
├── .agents/
│   ├── AGENTS.md
│   └── plans/bun-template/
├── .github/
│   ├── dependabot.yml
│   └── workflows/ci.yml
├── deployments/
│   ├── kustomize/
│   │   ├── base/
│   │   └── overlays/development/
│   └── observability/
├── migrations/                         # drizzle-kit SQL migrations (committed)
│   └── meta/
├── src/
│   ├── main.ts                         # composition root + graceful shutdown
│   ├── migrate.ts                      # migration runner entry
│   ├── app/
│   │   ├── container.ts                # Container class (DI composition root)
│   │   └── app.ts                      # build() + run() orchestrator
│   ├── config/
│   │   ├── config.ts                   # Zod schema + load() + validate()
│   │   └── config.test.ts
│   ├── shared/
│   │   ├── errors/                     # AppError + sentinels + mapper
│   │   ├── middleware/                 # request-id, recover, access-log, cors, otel
│   │   ├── server/                     # buildApp() + Application
│   │   └── telemetry/                  # logger, tracer, meter, health
│   ├── infrastructure/
│   │   ├── db/                         # drizzle + postgres-js
│   │   └── messaging/                  # ioredis (valkey)
│   ├── features/
│   │   └── example/                    # STUB FEATURE — delete to start
│   │       ├── domain/
│   │       ├── dto/
│   │       ├── repository/
│   │       ├── service/
│   │       ├── handler/
│   │       └── di.ts
│   └── index.ts                        # re-exports (App type for hc clients)
├── test/
│   └── e2e/
│       └── server.e2e.test.ts
├── .editorconfig
├── .env.example
├── .gitignore
├── biome.json
├── compose.yml
├── config.yaml
├── Containerfile
├── Containerfile.migrate
├── drizzle.config.ts
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
└── vitest.config.ts
```

## Architecture overview

The template follows **clean architecture** inside each feature: `domain` defines entities and ports, `repository` implements the outbound port (Drizzle ORM over postgres-js), `service` implements the inbound use-case port, and `handler` exposes HTTP endpoints (Hono sub-apps). Dependencies point inward.

Composition uses a lightweight hand-written **`Container`** class: every layer/feature exposes a `register(container)` function, and `src/app/app.ts` bootstraps in dependency order:

```
config → telemetry → infrastructure (db, valkey) → features → server
```

Type-safe RPC is achieved by exporting the Hono `AppType` from `src/index.ts`; clients use `hc<AppType>()` from `hono/client` for end-to-end typed requests. No gRPC, no protobuf.

Configuration is loaded from `config.yaml` and merged with environment overrides (env wins) into a typed, validated object via Zod. Durations accept strings like `15s`/`30m`/`1h` or bare numbers.

## Deleting the stub feature

1. Remove `src/features/example/`.
2. Remove the `example.register(container)` call from `src/app/app.ts`.
3. Delete the `example:` block from `config.yaml` and `.env.example`.

Then add your own feature packages under `src/features/` and wire them in `src/app/app.ts`.

## Testing

- Unit (hermetic, mocked): `bun run test:unit`
- Integration (requires Postgres + Valkey): `bun run test:integration`
- End-to-end: `bun run test:e2e`
- Coverage (gate 60%): `bun run test:coverage`

## Deployment

- `Containerfile` builds a multi-stage, non-root server image on `oven/bun:1-slim`.
- `Containerfile.migrate` builds a self-contained migration runner that applies the SQL files under `migrations/`.
- `compose.yml` runs postgres, valkey, migrate, and server locally.
- Kubernetes manifests are under `deployments/kustomize/`.
- CI runs lint + typecheck + unit + integration + build (`.github/workflows/ci.yml`).