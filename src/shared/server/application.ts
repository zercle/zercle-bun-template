/**
 * Application orchestrator: owns `Bun.serve` lifecycle and the ordered
 * graceful-shutdown sequence. Signal handling is registered separately by
 * the composition root (`src/app/app.ts`).
 *
 * Mirrors the Go template's `server.Application` (`shutdown.go`):
 *   1. stop accepting HTTP connections (bounded by `app.shutdown_timeout`)
 *   2. close db (`DBHandle.end()`)
 *   3. close valkey (`ValkeyClient.quit()`)
 *   4. flush + shutdown OTel tracer provider
 *   5. log "shutdown complete"
 */
import type pino from "pino";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/db.ts";
import { type ValkeyClient, ValkeyKey } from "../../infrastructure/messaging/valkey.ts";
import { LoggerKey, type TracerHandle, TracerKey } from "../telemetry/index.ts";
import { buildApp } from "./http.ts";

export class Application {
  private server?: ReturnType<typeof Bun.serve>;
  private readonly logger: pino.Logger;
  private readonly cfg: Config;
  private readonly container: Container;

  constructor(container: Container) {
    this.container = container;
    this.cfg = container.resolve<Config>(ConfigKey);
    this.logger = container.resolve<pino.Logger>(LoggerKey);
  }

  async start(): Promise<void> {
    const app = buildApp(this.container);
    const port = this.cfg.http.port;
    const hostname = this.cfg.http.host;
    this.server = Bun.serve({ port, hostname, fetch: app.fetch });
    this.logger.info(
      { port, host: hostname, env: this.cfg.app.environment },
      "http server listening",
    );
  }

  async stop(): Promise<void> {
    const timeoutMs = this.cfg.app.shutdown_timeout * 1000;
    await this.stopServer(timeoutMs);
    await this.closeDB();
    await this.closeValkey();
    await this.shutdownTracer();
    this.logger.info("shutdown complete");
  }

  get addr(): { hostname: string; port: number } | undefined {
    if (!this.server) return undefined;
    const hostname = this.server.hostname ?? "";
    const port = this.server.port ?? 0;
    return { hostname, port };
  }

  private async stopServer(timeoutMs: number): Promise<void> {
    const server = this.server;
    if (!server) return;

    // Stop accepting new connections. Bun's server.stop() is synchronous;
    // passing `false` initiates a drain without forcibly closing active
    // sockets, so we must poll pendingRequests ourselves.
    server.stop(false);

    const start = Date.now();
    while (server.pendingRequests > 0 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Force-close any connections still active after the timeout.
    if (server.pendingRequests > 0) {
      try {
        server.stop(true);
      } catch {
        // ignore double-stop
      }
    }
    this.server = undefined;
  }

  private async closeDB(): Promise<void> {
    const handle = this.container.tryResolve<DBHandle>(DBKey);
    if (!handle) return;
    try {
      await handle.end();
    } catch (err) {
      this.logger.warn({ err }, "db close error");
    }
  }

  private async closeValkey(): Promise<void> {
    const client = this.container.tryResolve<ValkeyClient>(ValkeyKey);
    if (!client) return;
    try {
      await client.quit();
    } catch (err) {
      this.logger.warn({ err }, "valkey close error");
    }
  }

  private async shutdownTracer(): Promise<void> {
    const tracer = this.container.tryResolve<TracerHandle>(TracerKey);
    if (!tracer) return;
    try {
      await tracer.shutdown();
    } catch (err) {
      this.logger.warn({ err }, "tracer shutdown error");
    }
  }
}
