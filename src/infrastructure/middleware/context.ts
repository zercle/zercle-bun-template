import { AsyncLocalStorage } from "node:async_hooks";

const requestIdStore = new AsyncLocalStorage<string>();

export function getRequestId(): string {
  return requestIdStore.getStore() ?? "";
}

export function runWithRequestId<T>(id: string, fn: () => T): T {
  return requestIdStore.run(id, fn);
}
