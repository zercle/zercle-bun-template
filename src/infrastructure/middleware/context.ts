import { AsyncLocalStorage } from "node:async_hooks";
import type { Span } from "@opentelemetry/api";

/** Per-request state shared by the middleware stack. */
export interface RequestState {
  requestId: string;
  startedAt: number;
  /** The span opened for this request, closed when the response is mapped. */
  span?: Span;
}

const requestStore = new AsyncLocalStorage<RequestState>();

export function getRequestState(): RequestState | undefined {
  return requestStore.getStore();
}

export function getRequestId(): string {
  return requestStore.getStore()?.requestId ?? "";
}

export function runWithRequestId<T>(id: string, fn: () => T): T {
  return requestStore.run({ requestId: id, startedAt: performance.now() }, fn);
}

/**
 * Bind the request state to the current request context without wrapping a
 * callback.
 *
 * Elysia's lifecycle hooks do not wrap the handler in a callback the way
 * Hono's `next()` did, so there is no scope to run the rest of the request in.
 * `enterWith` binds the state to the surrounding async context instead, which
 * reaches the handler and every hook that runs after this one.
 */
export function enterRequestState(state: RequestState): void {
  requestStore.enterWith(state);
}
