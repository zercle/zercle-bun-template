# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# deps — install production node_modules (runtime deps only)
# -----------------------------------------------------------------------------
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# -----------------------------------------------------------------------------
# builder — typecheck gate (Bun runs TS directly; no compile step)
# -----------------------------------------------------------------------------
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY package.json tsconfig.json config.yaml ./

RUN bun run typecheck

# -----------------------------------------------------------------------------
# final — slim runtime image, non-root
# -----------------------------------------------------------------------------
FROM oven/bun:1-slim AS final

WORKDIR /app

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/src ./src
COPY --from=builder --chown=bun:bun /app/migrations ./migrations
COPY --from=builder --chown=bun:bun /app/package.json /app/tsconfig.json /app/config.yaml ./

USER bun

EXPOSE 8080

ENTRYPOINT ["bun", "run", "src/main.ts"]
