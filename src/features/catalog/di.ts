/**
 * Feature composition: registers sentinels, builds the driven adapter
 * (postgres repository, optionally wrapped in cache-aside), the application
 * use case, and the driving HTTP adapter, then mounts the router on the
 * platform Hono app.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../platform/errors/app-error.ts";
import { registerSentinel } from "../../platform/errors/sentinel.ts";
import { type CacheAside, CacheAsideKey } from "../../platform/messaging/cache-aside.ts";
import { AppKey } from "../../platform/server/index.ts";
import { createCatalogRouter } from "./adapter/in/http/handler.ts";
import { CachedProductRepository } from "./adapter/out/postgres/cached-repository.ts";
import { DrizzleProductRepository } from "./adapter/out/postgres/repository.ts";
import type { ProductService } from "./application/service.ts";
import { ProductUsecase } from "./application/usecase.ts";
import {
  ErrInvalidID,
  ErrInvalidPrice,
  ErrInvalidProductName,
  ErrProductNotFound,
} from "./domain/errors.ts";

export const CatalogRouterKey = Symbol("CatalogRouter");

/**
 * Register the catalog feature. When `cfg.catalog.enabled` is false the
 * feature is not registered at all: no providers, no routes, no sentinel
 * mappings.
 */
export function register(container: Container): void {
  const cfg = container.resolve<Config>(ConfigKey);
  if (!cfg.catalog.enabled) {
    return;
  }

  registerSentinel(ErrProductNotFound, ErrNotFound);
  registerSentinel(ErrInvalidID, ErrInvalidInput);
  registerSentinel(ErrInvalidProductName, ErrInvalidInput);
  registerSentinel(ErrInvalidPrice, ErrInvalidInput);

  const handle = container.resolve<DBHandle>(DBKey);

  const baseRepo = new DrizzleProductRepository(handle.db);
  // Decorate with cache-aside reads when a cache-aside facade is registered;
  // otherwise the feature works directly against the database. Only a missing
  // registration falls back — a construction failure is a real error and must
  // not be swallowed.
  const aside = container.tryResolve<CacheAside>(CacheAsideKey);
  const repo = aside !== undefined ? new CachedProductRepository(baseRepo, aside) : baseRepo;

  const service: ProductService = new ProductUsecase(repo, {
    defaultPageSize: cfg.catalog.default_page_size,
    maxPageSize: cfg.catalog.max_page_size,
    maxNameLength: cfg.catalog.max_name_length,
  });

  const router = createCatalogRouter({ service });
  container.registerValue(CatalogRouterKey, router);

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
