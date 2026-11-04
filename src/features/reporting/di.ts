/**
 * Feature composition: registers sentinels, builds the postgres repository
 * implementation, the usecase, and the HTTP handler, then mounts the router on
 * the infrastructure Elysia app. The reporting
 * feature owns no schema, so it contributes no migrations.
 */
import type { Elysia } from "elysia";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../infrastructure/config/config.ts";
import { type DBHandle, DBKey } from "../../infrastructure/db/index.ts";
import { AppKey } from "../../infrastructure/server/index.ts";
import { ErrInvalidInput } from "../../shared/errors/app-error.ts";
import { registerSentinel } from "../../shared/errors/sentinel.ts";
import { ErrInvalidTopMachines } from "./domain/errors.ts";
import { createReportingRouter } from "./handler/handler.ts";
import { DrizzleReportingRepository } from "./repository/postgres/repository.ts";
import type { ReportingService } from "./usecase/service.ts";
import { ReportingUsecase } from "./usecase/usecase.ts";

export const ReportingRouterKey = Symbol("ReportingRouter");

/**
 * Wires the reporting feature into the composition root. When
 * `cfg.reporting.enabled` is false the feature is not registered at all: no
 * repository, no use case, no HTTP routes, no sentinel mappings.
 */
export function register(container: Container): void {
  const cfg = container.resolve<Config>(ConfigKey);
  if (!cfg.reporting.enabled) {
    return;
  }

  registerSentinel(ErrInvalidTopMachines, ErrInvalidInput);

  const handle = container.resolve<DBHandle>(DBKey);

  const repo = new DrizzleReportingRepository(handle.db);
  const service: ReportingService = new ReportingUsecase(
    repo,
    cfg.reporting.default_top_machines,
    cfg.reporting.max_top_machines,
  );

  const router = createReportingRouter({ service });
  container.registerValue(ReportingRouterKey, router);

  const app = container.resolve<Elysia>(AppKey);
  app.group("/api/v1", (group) => group.use(router));
}
