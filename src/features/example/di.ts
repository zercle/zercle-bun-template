// STUB FEATURE — delete src/features/example to start your project.

/**
 * Feature composition: registers sentinels, builds the driven adapter
 * (postgres repository), the application use case, and the driving HTTP
 * adapter, then mounts the router on the platform Hono app.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../platform/errors/app-error.ts";
import { registerSentinel } from "../../platform/errors/sentinel.ts";
import { AppKey } from "../../platform/server/index.ts";
import { createExampleRouter } from "./adapter/in/http/handler.ts";
import { DrizzleItemRepository } from "./adapter/out/postgres/repository.ts";
import type { ItemService } from "./application/service.ts";
import { ItemUsecase } from "./application/usecase.ts";
import { ErrInvalidID, ErrInvalidName, ErrItemNotFound } from "./domain/errors.ts";

export const ExampleRouterKey = Symbol("ExampleRouter");

export function register(container: Container): void {
  registerSentinel(ErrItemNotFound, ErrNotFound);
  registerSentinel(ErrInvalidName, ErrInvalidInput);
  registerSentinel(ErrInvalidID, ErrInvalidInput);

  const cfg = container.resolve<Config>(ConfigKey);
  const handle = container.resolve<DBHandle>(DBKey);

  const repo = new DrizzleItemRepository(handle.db);
  const service: ItemService = new ItemUsecase(repo, {
    defaultPageSize: cfg.example.default_page_size,
    maxPageSize: cfg.example.max_page_size,
    maxNameLength: cfg.example.max_name_length,
  });

  const router = createExampleRouter({ service });
  container.registerValue(ExampleRouterKey, router);

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
