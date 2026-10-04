/**
 * Feature composition: registers sentinels, builds the driven adapter
 * (postgres repository), the application use case, and the driving HTTP
 * adapter, then mounts the router on the platform Hono app. When
 * `cfg.machines.enabled` is false the feature is not registered at all: no
 * sentinel mappings, no repository, no routes.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../platform/errors/app-error.ts";
import { registerSentinel } from "../../platform/errors/sentinel.ts";
import { AppKey } from "../../platform/server/index.ts";
import { createMachinesRouter } from "./adapter/in/http/handler.ts";
import { DrizzleMachineRepository } from "./adapter/out/postgres/repository.ts";
import type { MachineService } from "./application/service.ts";
import { MachineUsecase } from "./application/usecase.ts";
import {
  ErrInvalidID,
  ErrInvalidMachineLabel,
  ErrMachineNotFound,
  ErrUnsupportedCoin,
} from "./domain/errors.ts";

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
