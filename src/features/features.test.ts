import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../app/container.ts";

const { calls, catalogRegister, machinesRegister, salesRegister } = vi.hoisted(() => {
  const calls: string[] = [];
  const catalogRegister = vi.fn(() => {
    calls.push("catalog");
  });
  const machinesRegister = vi.fn(() => {
    calls.push("machines");
  });
  const salesRegister = vi.fn(() => {
    calls.push("sales");
  });
  return { calls, catalogRegister, machinesRegister, salesRegister };
});

vi.mock("./catalog/di.ts", () => ({ register: catalogRegister }));
vi.mock("./machines/di.ts", () => ({ register: machinesRegister }));
vi.mock("./sales/di.ts", () => ({ register: salesRegister }));

const { features, migrationSources, registerAll } = await import("./features.ts");

const fakeContainer = {} as Container;

beforeEach(() => {
  calls.length = 0;
  catalogRegister.mockClear().mockImplementation(() => {
    calls.push("catalog");
  });
  machinesRegister.mockClear().mockImplementation(() => {
    calls.push("machines");
  });
  salesRegister.mockClear().mockImplementation(() => {
    calls.push("sales");
  });
});

describe("feature registry", () => {
  it("lists catalog, machines, sales in migration order", () => {
    expect(features.map((f) => f.name)).toEqual(["catalog", "machines", "sales"]);
  });

  it("gives every demo feature a repo-root-relative migrations dir", () => {
    for (const feature of features) {
      expect(feature.migrationsDir).toBe(
        `src/features/${feature.name}/adapter/out/postgres/migrations`,
      );
    }
  });

  it("returns migration sources in registry order", () => {
    expect(migrationSources()).toEqual([
      { feature: "catalog", dir: "src/features/catalog/adapter/out/postgres/migrations" },
      { feature: "machines", dir: "src/features/machines/adapter/out/postgres/migrations" },
      { feature: "sales", dir: "src/features/sales/adapter/out/postgres/migrations" },
    ]);
  });
});

describe("registerAll", () => {
  it("registers every feature in registry order", () => {
    registerAll(fakeContainer);
    expect(calls).toEqual(["catalog", "machines", "sales"]);
  });

  it("wraps a registration failure with the failing feature name", () => {
    catalogRegister.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => registerAll(fakeContainer)).toThrow(/register catalog feature failed/);
  });
});
