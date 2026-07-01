import pino from "pino";
import type { Config } from "../../config/config";

export const LoggerKey = Symbol("Logger");

export function createLogger(cfg: Config): pino.Logger {
  const level = cfg.log.level;
  if (cfg.log.format === "console") {
    return pino({
      level,
      transport: { target: "pino-pretty" },
    });
  }
  return pino({ level });
}
