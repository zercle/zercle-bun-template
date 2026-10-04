/**
 * Feature composition: registers sentinels, builds the driven adapter
 * (postgres repository), the application use case, and the driving HTTP
 * adapter, then mounts the router on the platform Hono app.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { ErrConflict, ErrInvalidInput, ErrNotFound } from "../../platform/errors/app-error.ts";
import { registerSentinel } from "../../platform/errors/sentinel.ts";
import { AppKey } from "../../platform/server/index.ts";
import { createSalesRouter } from "./adapter/in/http/handler.ts";
import { DrizzleSalesRepository } from "./adapter/out/postgres/repository.ts";
import type { SalesService } from "./application/service.ts";
import { SalesUsecase } from "./application/usecase.ts";
import {
  ErrExactChangeRequired,
  ErrInsufficientPayment,
  ErrInvalidID,
  ErrMachineNotFound,
  ErrOutOfStock,
  ErrProductNotFound,
  ErrUnsupportedCoin,
} from "./domain/errors.ts";

export const SalesRouterKey = Symbol("SalesRouter");

/**
 * Wires the sales feature into the composition root. When `cfg.sales.enabled`
 * is false the feature is not registered at all: no repository, no use case,
 * no HTTP routes, no sentinel mappings.
 */
export function register(container: Container): void {
  const cfg = container.resolve<Config>(ConfigKey);
  if (!cfg.sales.enabled) {
    return;
  }

  registerSentinel(ErrProductNotFound, ErrNotFound);
  registerSentinel(ErrMachineNotFound, ErrNotFound);
  registerSentinel(ErrOutOfStock, ErrConflict);
  registerSentinel(ErrInvalidID, ErrInvalidInput);
  registerSentinel(ErrUnsupportedCoin, ErrInvalidInput);
  registerSentinel(ErrInsufficientPayment, ErrInvalidInput);
  registerSentinel(ErrExactChangeRequired, ErrInvalidInput);

  const handle = container.resolve<DBHandle>(DBKey);

  const repo = new DrizzleSalesRepository(handle.db);
  const service: SalesService = new SalesUsecase(repo);

  const router = createSalesRouter({ service });
  container.registerValue(SalesRouterKey, router);

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
