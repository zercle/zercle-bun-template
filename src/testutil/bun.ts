import { vi } from "vitest";

/**
 * Replace `Bun.serve` for the duration of a test.
 *
 * Vitest's workers run under Node on CI and under Bun locally, and the two
 * disagree about the global: Node has no `Bun` at all, while the Bun runtime
 * defines it as a read-only property that cannot be replaced. So the global is
 * stubbed where it is missing and the method is spied on where it exists.
 *
 * Call `restoreBunServe()` (or `vi.unstubAllGlobals()` plus
 * `vi.restoreAllMocks()`) to put the runtime back.
 */
export function stubBunServe(serve: unknown): void {
  if (typeof Bun === "undefined") {
    vi.stubGlobal("Bun", { serve });
    return;
  }
  vi.spyOn(Bun, "serve").mockImplementation(serve as never);
}

/** Undo whatever `stubBunServe` replaced. */
export function restoreBunServe(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
