import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../app/container.ts";

const { calls, catalogRegister, machinesRegister, salesRegister, reportingRegister } = vi.hoisted(
  () => {
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
    const reportingRegister = vi.fn(() => {
      calls.push("reporting");
    });
    return { calls, catalogRegister, machinesRegister, salesRegister, reportingRegister };
  },
);

vi.mock("./catalog/di.ts", () => ({ register: catalogRegister }));
vi.mock("./machines/di.ts", () => ({ register: machinesRegister }));
vi.mock("./sales/di.ts", () => ({ register: salesRegister }));
vi.mock("./reporting/di.ts", () => ({ register: reportingRegister }));

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
  reportingRegister.mockClear().mockImplementation(() => {
    calls.push("reporting");
  });
});

describe("feature registry", () => {
  it("lists catalog, machines, sales, reporting in registry order", () => {
    expect(features.map((f) => f.name)).toEqual(["catalog", "machines", "sales", "reporting"]);
  });

  it("gives every schema-owning feature a repo-root-relative migrations dir", () => {
    const withSchema = features.filter((f) => f.migrationsDir !== undefined);
    expect(withSchema.map((f) => f.name)).toEqual(["catalog", "machines", "sales"]);
    for (const feature of withSchema) {
      expect(feature.migrationsDir).toBe(
        `src/features/${feature.name}/adapter/out/postgres/migrations`,
      );
    }
  });

  it("leaves reporting without a migrations dir", () => {
    const reporting = features.find((f) => f.name === "reporting");
    expect(reporting?.migrationsDir).toBeUndefined();
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
    expect(calls).toEqual(["catalog", "machines", "sales", "reporting"]);
  });

  it("wraps a registration failure with the failing feature name", () => {
    catalogRegister.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => registerAll(fakeContainer)).toThrow(/register catalog feature failed/);
  });
});
