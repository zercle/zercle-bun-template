/**
 * Unit tests for the composition root `app.run()`: signal-driven shutdown
 * behavior. We mock every layer the composition root would touch and exercise
 * the SIGTERM/SIGINT handlers so we can assert process exit code and logger
 * calls without binding ports or connecting to real services.
 */
import type pino from "pino";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { fakeApp, loggerInfo, loggerError } = vi.hoisted(() => {
  const fakeApp = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };
  const loggerInfo = vi.fn();
  const loggerError = vi.fn();
  return { fakeApp, loggerInfo, loggerError };
});

const fakeLogger = {
  info: loggerInfo,
  error: loggerError,
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
} as unknown as pino.Logger;

vi.mock("../config/config.ts", () => ({
  ConfigKey: Symbol("Config"),
  loadConfig: () => ({ app: { name: "t" } }),
}));

vi.mock("../shared/telemetry/register.ts", () => ({
  register: vi.fn(),
}));

vi.mock("../infrastructure/db/register.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../infrastructure/messaging/valkey.ts", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  ValkeyKey: Symbol("Valkey"),
}));

vi.mock("../shared/server/register.ts", () => ({
  ApplicationKey: Symbol.for("Application"),
  register: vi.fn(),
}));

vi.mock("../shared/server/index.ts", () => ({
  ApplicationKey: Symbol.for("Application"),
}));

vi.mock("../features/example/di.ts", () => ({
  register: vi.fn(),
}));

vi.mock("./container.ts", () => {
  class Container {
    private readonly map = new Map<symbol, unknown>();
    registerValue<T>(key: symbol, value: T): void {
      this.map.set(key, value);
    }
    resolve<T>(key: symbol): T {
      if (!this.map.has(key)) {
        throw new Error(`not registered: ${String(key.description ?? key)}`);
      }
      return this.map.get(key) as T;
    }
    tryResolve<T>(key: symbol): T | undefined {
      return this.map.get(key) as T | undefined;
    }
  }
  return { Container };
});

beforeAll(() => {
  // The composition root installs `void shutdown(...)` handlers whose
  // rejected promise surfaces as an unhandled rejection under vitest because
  // process.exit was mocked. Swallow them — the assertions verify the exit
  // code path directly.
  process.on("unhandledRejection", () => {});
});

beforeEach(async () => {
  loggerInfo.mockReset();
  loggerError.mockReset();
  fakeApp.start.mockClear();
  fakeApp.stop.mockReset().mockResolvedValue(undefined);
  fakeApp.start.mockClear();

  const serverMod = await import("../shared/server/register.ts");
  (serverMod.register as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (c: { registerValue: (k: symbol, v: unknown) => void }) => {
      c.registerValue(serverMod.ApplicationKey, fakeApp);
    },
  );

  const telemetryMod = await import("../shared/telemetry/register.ts");
  const { LoggerKey } = await import("../shared/telemetry/index.ts");
  (telemetryMod.register as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (c: { registerValue: (k: symbol, v: unknown) => void }) => {
      c.registerValue(LoggerKey, fakeLogger);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadRun(): Promise<() => Promise<void>> {
  const mod = await import("./app.ts");
  return mod.run;
}

function clearSignalHandlers(): void {
  for (const l of process.listeners("SIGTERM") as Array<() => void>) {
    process.removeListener("SIGTERM", l);
  }
  for (const l of process.listeners("SIGINT") as Array<() => void>) {
    process.removeListener("SIGINT", l);
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const t0 = Date.now();
  while (!predicate()) {
    if (Date.now() - t0 > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("app.run shutdown", () => {
  it("logs and exits 1 when application.stop rejects", async () => {
    let exitCallCount = 0;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      exitCallCount += 1;
      return undefined as never;
    }) as never);
    clearSignalHandlers();

    const boom = new Error("drain failed");
    fakeApp.stop.mockImplementation(() => Promise.reject(boom));

    const run = await loadRun();
    await run();

    const sigtermHandler = process.listeners("SIGTERM").at(-1) as () => void;
    expect(sigtermHandler).toBeDefined();
    sigtermHandler();
    await waitFor(() => exitCallCount > 0);

    // In production the catch block calls process.exit(1) which terminates
    // the process before reaching process.exit(0). Under the mock, exit
    // doesn't terminate, so we assert that exit(1) was the *first* call.
    expect(exitSpy).toHaveBeenNthCalledWith(1, 1);
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: boom, sig: "SIGTERM" }),
      "shutdown failed",
    );
    expect(loggerInfo).toHaveBeenCalledWith({ sig: "SIGTERM" }, "shutdown signal received");
  });

  it("exits 0 when application.stop succeeds", async () => {
    let exitCode: number | undefined;
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      exitCode = code;
      return undefined as never;
    }) as never);
    clearSignalHandlers();

    const run = await loadRun();
    await run();

    const sigtermHandler = process.listeners("SIGTERM").at(-1) as () => void;
    sigtermHandler();
    await waitFor(() => exitCode !== undefined);

    expect(exitCode).toBe(0);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("ignores subsequent shutdown signals (reentrancy guard)", async () => {
    let exitCount = 0;
    vi.spyOn(process, "exit").mockImplementation((() => {
      exitCount += 1;
      return undefined as never;
    }) as never);
    clearSignalHandlers();

    let resolveStop: (() => void) | undefined;
    fakeApp.stop.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveStop = resolve;
        }),
    );

    const run = await loadRun();
    await run();

    const sigtermHandler = process.listeners("SIGTERM").at(-1) as () => void;
    sigtermHandler();
    // Second call should be a no-op because shuttingDown is true.
    sigtermHandler();
    resolveStop?.();
    await waitFor(() => exitCount > 0);
    // Give any stray calls a chance to fire.
    await new Promise((r) => setTimeout(r, 20));

    expect(exitCount).toBe(1);
  });
});
