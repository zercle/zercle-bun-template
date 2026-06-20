// STUB FEATURE — delete src/features/example to start your project.
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../shared/errors/app-error.ts";
import { registerSentinel } from "../../shared/errors/sentinel.ts";
import { AppKey } from "../../shared/server/index.ts";
import { ErrInvalidID, ErrInvalidName, ErrItemNotFound } from "./domain/errors.ts";
import type { ItemService } from "./domain/service.ts";
import { createExampleRouter } from "./handler/http.ts";
import { DrizzleItemRepository } from "./repository/repository.ts";
import { ItemServiceImpl } from "./service/service.ts";

export const ExampleRouterKey = Symbol("ExampleRouter");

export function register(container: Container): void {
  registerSentinel(ErrItemNotFound, ErrNotFound);
  registerSentinel(ErrInvalidName, ErrInvalidInput);
  registerSentinel(ErrInvalidID, ErrInvalidInput);

  const cfg = container.resolve<Config>(ConfigKey);
  const handle = container.resolve<DBHandle>(DBKey);

  const repo = new DrizzleItemRepository(handle.db);
  const service: ItemService = new ItemServiceImpl(repo, {
    defaultPageSize: cfg.example.default_page_size,
    maxPageSize: cfg.example.max_page_size,
    maxNameLength: cfg.example.max_name_length,
  });

  const router = createExampleRouter({ service });
  container.registerValue(ExampleRouterKey, router);

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
