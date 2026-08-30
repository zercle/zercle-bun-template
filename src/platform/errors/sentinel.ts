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
    const visited = new Set<Error>();
    let current: unknown = err;
    while (current instanceof Error && !visited.has(current)) {
      visited.add(current);
      if (current === entry.sentinel) {
        return entry.app;
      }
      current = current.cause;
    }
  }
  return undefined;
}
