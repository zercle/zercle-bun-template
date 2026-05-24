FROM oven/bun:1-slim AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S bunjs -u 1001

COPY package.json bun.lockb ./

RUN bun install --frozen-lockfile --production

COPY . .

USER bunjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD bun run healthcheck || exit 1

CMD ["bun", "run", "src/index.ts"]
