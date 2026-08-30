/**
 * DI registration for the shared server layer: Hono app + Application
 * orchestrator. Depends on `Config`, `Logger`, and `HealthRegistry` already
 * being registered in the container.
 */
import type { Container } from "../../app/container.ts";
import { Application } from "./application.ts";
import { AppKey, buildApp } from "./http.ts";

/** Symbol used to register the `Application` orchestrator in the DI container. */
export const ApplicationKey = Symbol("Application");

/**
 * Build the Hono app and the `Application` orchestrator and register both
 * in the container. Idempotent only at the level of a fresh container — the
 * underlying `Bun.serve` lifecycle is owned by the `Application` instance.
 */
export function register(container: Container): void {
  const app = buildApp(container);
  container.registerValue(AppKey, app);
  const application = new Application(container);
  container.registerValue(ApplicationKey, application);
}
