/**
 * Feature composition: registers sentinels, builds the driven adapter
 * (postgres repository), the application use case, and the driving HTTP
 * adapter, then mounts the router on the platform Hono app. The reporting
 * feature owns no schema, so it contributes no migrations.
 */
import type { Hono } from "hono";
import type { Container } from "../../app/container.ts";
import { type Config, ConfigKey } from "../../config/config.ts";
import { type DBHandle, DBKey } from "../../platform/db/index.ts";
import { ErrInvalidInput } from "../../platform/errors/app-error.ts";
import { registerSentinel } from "../../platform/errors/sentinel.ts";
import { AppKey } from "../../platform/server/index.ts";
import { createReportingRouter } from "./adapter/in/http/handler.ts";
import { DrizzleReportingRepository } from "./adapter/out/postgres/repository.ts";
import type { ReportingService } from "./application/service.ts";
import { ReportingUsecase } from "./application/usecase.ts";
import { ErrInvalidTopMachines } from "./domain/errors.ts";

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

  const app = container.resolve<Hono>(AppKey);
  app.route("/api/v1", router);
}
