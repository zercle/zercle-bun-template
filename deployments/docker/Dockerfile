# Build stage
FROM mirror.gcr.io/oven/bun:latests AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y git make tini

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Compile your application into a single executable binary
RUN bun build src/main.ts --compile --minify --outfile ./dist/bun-app

# Final stage - distroless minimal runtime
FROM gcr.io/distroless/base AS runner

ENV TZ=Asia/Bangkok
ENV LANG=C.UTF-8

WORKDIR /opt/app

# Copy tini static binary from builder
COPY --from=builder /usr/bin/tini-static /usr/bin/tini

# Copy the compiled binary from the 'build' stage
COPY --from=build /app/dist ./

# Expose port
EXPOSE 3000

# Run the application
ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["./bun-app"]
