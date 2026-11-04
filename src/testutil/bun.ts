import { vi } from "vitest";

/**
 * Replace `Bun.serve` for the duration of a test.
 *
 * Vitest's workers run under Node on CI and under Bun locally, and the two
 * disagree about the global: Node has no `Bun` at all, while the Bun runtime
 * defines it as a read-only property that cannot be replaced. So the global is
 * stubbed where it is missing and the method is spied on where it exists.
 *
 * The stub is deliberately not a bare `{ serve }`: Elysia detects its runtime
 * with `typeof Bun < "u"`, so a stubbed global makes it read `Bun.env`,
 * `Bun.semver`, and `Bun.gc`. The stub therefore mirrors the parts of the Bun
 * global Elysia touches, so the code under test runs as it would under Bun.
 *
 * Call `restoreBunServe()` to put the runtime back.
 */
export function stubBunServe(serve: unknown): void {
  if (typeof Bun === "undefined") {
    vi.stubGlobal("Bun", {
      serve,
      env: process.env,
      file: () => {
        throw new Error("Bun.file is not available in the test stub");
      },
      semver: { satisfies: () => true },
      gc: () => {},
    });
    return;
  }
  vi.spyOn(Bun, "serve").mockImplementation(serve as never);
}

/** Undo whatever `stubBunServe` replaced. */
export function restoreBunServe(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
