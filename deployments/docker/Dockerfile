# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build the application
RUN bun build src/main.ts --outdir ./dist

# Runtime stage
FROM oven/bun:1 AS runtime

WORKDIR /app

# Install runtime dependencies only
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S bun && \
    adduser -S -u 1001 -G bun bun

# Change ownership
RUN chown -R bun:bun /app

USER bun

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Run the application
CMD ["bun", "run", "dist/main.js"]
