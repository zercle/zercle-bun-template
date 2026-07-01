import type { Container } from "../../app/container";
import { type Config, ConfigKey } from "../../config/config";
import { type HealthRegistry, HealthRegistryKey } from "../../shared/telemetry/health";
import { createDB, DBKey } from "./db";
import { postgresChecker } from "./health";

export async function register(container: Container): Promise<void> {
  const cfg = container.resolve<Config>(ConfigKey);
  const handle = await createDB(cfg);
  container.registerValue(DBKey, handle);

  const registry = container.resolve<HealthRegistry>(HealthRegistryKey);
  registry.addReadiness(postgresChecker(handle));
}
