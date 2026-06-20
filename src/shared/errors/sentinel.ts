import type { AppError } from "./app-error.ts";

interface SentinelEntry {
  sentinel: Error;
  app: AppError;
}

const registeredSentinels: SentinelEntry[] = [];

export function registerSentinel(sentinel: Error, app: AppError): void {
  registeredSentinels.push({ sentinel, app });
}

export function sentinelFor(err: Error): AppError | undefined {
  for (const entry of registeredSentinels) {
    let current: unknown = err;
    while (current instanceof Error) {
      if (current === entry.sentinel) {
        return entry.app;
      }
      current = current.cause;
    }
  }
  return undefined;
}
