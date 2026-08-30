# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# builder — install deps, typecheck gate, compile standalone executables
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

# Compile self-contained Linux executables (embeds Bun runtime + all JS deps).
# No node_modules needed in the final image.
RUN bun build --compile src/main.ts --outfile main

# -----------------------------------------------------------------------------
# final — distroless, non-root, no node_modules
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/base-debian13:nonroot AS final

# Build metadata consumed by src/main.ts at startup (see CD workflow).
ARG APP_VERSION=dev
ARG APP_COMMIT_SHA=unknown
ARG APP_BUILD_TIME=unknown
ENV APP_VERSION=${APP_VERSION} \
    APP_COMMIT_SHA=${APP_COMMIT_SHA} \
    APP_BUILD_TIME=${APP_BUILD_TIME}

WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/main /app/main
COPY --from=builder --chown=nonroot:nonroot /app/migrations ./migrations
COPY --from=builder --chown=nonroot:nonroot /app/config.yaml /app/config.yaml

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/app/main"]