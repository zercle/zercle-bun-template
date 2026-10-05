/**
 * Feature composition: registers sentinels, builds the postgres repository
 * implementation (optionally wrapped in cache-aside), the usecase, and the
 * HTTP handler, then mounts the router on the infrastructure Hono app.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { ErrInvalidInput, ErrNotFound } from "../../infrastructure/errors/app-error.ts";
import { registerSentinel } from "../../infrastructure/errors/sentinel.ts";
import { type CacheAside, CacheAsideKey } from "../../infrastructure/messaging/cache-aside.ts";
import { AppKey } from "../../infrastructure/server/index.ts";
import {
  ErrInvalidID,
  ErrInvalidPrice,
  ErrInvalidProductName,
  ErrProductNotFound,
} from "./domain/errors.ts";
import { createCatalogRouter } from "./handler/handler.ts";
import { CachedProductRepository } from "./repository/postgres/cached-repository.ts";
import { DrizzleProductRepository } from "./repository/postgres/repository.ts";
import type { ProductService } from "./usecase/service.ts";
import { ProductUsecase } from "./usecase/usecase.ts";

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
