/**
 * Feature composition: registers sentinels, builds the postgres repository
 * implementation, the usecase, and the HTTP handler, then mounts the router on
 * the infrastructure Hono app. When
 * `cfg.machines.enabled` is false the feature is not registered at all: no
 * sentinel mappings, no repository, no routes.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../infrastructure/errors/app-error.ts";
import { registerSentinel } from "../../infrastructure/errors/sentinel.ts";
import { AppKey } from "../../infrastructure/server/index.ts";
import {
  ErrInvalidID,
  ErrInvalidMachineLabel,
  ErrMachineNotFound,
  ErrUnsupportedCoin,
} from "./domain/errors.ts";
import { createMachinesRouter } from "./handler/handler.ts";
import { DrizzleMachineRepository } from "./repository/postgres/repository.ts";
import type { MachineService } from "./usecase/service.ts";
import { MachineUsecase } from "./usecase/usecase.ts";

export const MachinesRouterKey = Symbol("MachinesRouter");

export function register(container: Container): void {
  const cfg = container.resolve<Config>(ConfigKey);
  if (!cfg.machines.enabled) {
    return;
  }

  registerSentinel(ErrMachineNotFound, ErrNotFound);
  registerSentinel(ErrInvalidID, ErrInvalidInput);
  registerSentinel(ErrInvalidMachineLabel, ErrInvalidInput);
  registerSentinel(ErrUnsupportedCoin, ErrInvalidInput);

  const handle = container.resolve<DBHandle>(DBKey);

  const repo = new DrizzleMachineRepository(handle.db);
  const service: MachineService = new MachineUsecase(repo, {
    defaultPageSize: cfg.machines.default_page_size,
    maxPageSize: cfg.machines.max_page_size,
    maxLabelLength: cfg.machines.max_label_length,
  });

  const router = createMachinesRouter({ service });
  container.registerValue(MachinesRouterKey, router);

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
