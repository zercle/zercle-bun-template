/**
 * Feature composition: registers sentinels, builds the postgres repository
 * implementation, the usecase, and the HTTP handler, then mounts the router on
 * the infrastructure Hono app.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import {
  ErrConflict,
  ErrInvalidInput,
  ErrNotFound,
} from "../../infrastructure/errors/app-error.ts";
import { registerSentinel } from "../../infrastructure/errors/sentinel.ts";
import { AppKey } from "../../infrastructure/server/index.ts";
import {
  ErrExactChangeRequired,
  ErrInsufficientPayment,
  ErrInvalidID,
  ErrMachineNotFound,
  ErrOutOfStock,
  ErrProductNotFound,
  ErrUnsupportedCoin,
} from "./domain/errors.ts";
import { createSalesRouter } from "./handler/handler.ts";
import { DrizzleSalesRepository } from "./repository/postgres/repository.ts";
import type { SalesService } from "./usecase/service.ts";
import { SalesUsecase } from "./usecase/usecase.ts";

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
