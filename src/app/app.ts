/**
 * Composition root: wires the DI container in dependency order and returns a
 * runnable `Application`. Mirrors the Go template's `internal/app/app.go`.
 *
 *   1. config  (load + register `Config`)
 *   2. telemetry (logger, tracer, meter, health registry)
 *   3. platform resources (db, valkey — async, requires live services)
 *   4. server (Hono app + Application)
 *   5. features (example)
 *
 * `build()` connects to real services. Tests should build a Hono app directly
 * via `buildApp(container)` against a hand-populated container — see
 * `src/platform/server/server.test.ts`.
 */
import type pino from "pino";
import { ConfigKey, loadConfig } from "../config/config.ts";
import * as example from "../features/example/di.ts";
import * as db from "../platform/db/register.ts";
import * as valkey from "../platform/messaging/valkey.ts";
import { type Application, ApplicationKey } from "../platform/server/index.ts";
import * as server from "../platform/server/register.ts";
import { LoggerKey } from "../platform/telemetry/index.ts";
import * as telemetry from "../platform/telemetry/register.ts";
import { Container } from "./container.ts";

/**
 * Wire all layers in dependency order and return the `Application`
 * orchestrator. On failure each layer is wrapped with a contextual rethrow so
 * the log line points at the failing subsystem; partially-populated state is
 * left in the container (callers are not expected to recover mid-startup).
 */
export async function build(container: Container): Promise<Application> {
  const cfg = loadConfig();
  container.registerValue(ConfigKey, cfg);

  await runStep("telemetry", () => telemetry.register(container));
  await runStep("db", () => db.register(container));
  await runStep("valkey", () => valkey.register(container));
  runStepSync("server", () => server.register(container));
  runStepSync("example", () => example.register(container));

  return container.resolve<Application>(ApplicationKey);
}

async function runStep(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (err) {
    throw new Error(`register ${name} failed`, { cause: err });
  }
}

function runStepSync(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    throw new Error(`register ${name} failed`, { cause: err });
  }
}

/**
 * Production entry point: build the application, install SIGTERM/SIGINT
 * handlers that gracefully shut down, and start the HTTP server. The process
 * stays alive for as long as `Bun.serve` is listening.
 */
export async function run(): Promise<void> {
  const container = new Container();
  const application = await build(container);
  const logger: pino.Logger = container.resolve<pino.Logger>(LoggerKey);

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, "shutdown signal received");
    try {
      await application.stop();
    } catch (err) {
      logger.error({ err, sig }, "shutdown failed");
      process.exit(1);
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  await application.start();
}
