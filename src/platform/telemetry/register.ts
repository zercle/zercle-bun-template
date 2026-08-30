import type { Container } from "../../app/container";
import { type Config, ConfigKey } from "../../config/config";
import { HealthRegistry, HealthRegistryKey } from "./health";
import { createLogger, LoggerKey } from "./logger";
import { createMeterRegistry, MeterKey } from "./meter";
import { startTracer, TracerKey } from "./tracer";

export async function register(container: Container): Promise<void> {
  const cfg = container.resolve<Config>(ConfigKey);

  container.registerValue(LoggerKey, createLogger(cfg));

  const tracer = await startTracer(cfg);
  if (tracer) {
    container.registerValue(TracerKey, tracer);
  }

  container.registerValue(MeterKey, createMeterRegistry());
  container.registerValue(HealthRegistryKey, new HealthRegistry());
}
