/**
 * Feature registry: the single enumeration point for every feature and the two
 * lists the composition root and the migration runner need, so adding or
 * deleting a feature touches exactly one entry here instead of each call site.
 *
 * Mirrors the Go template's `internal/features/features.go`.
 */
import type { Container } from "../app/container.ts";
import * as catalog from "./catalog/di.ts";
import * as machines from "./machines/di.ts";
import * as reporting from "./reporting/di.ts";
import * as sales from "./sales/di.ts";

/** One feature's wiring and persistence contribution. */
export interface Feature {
  name: string;
  register(c: Container): void;
  /** Feature-owned migrations dir (repo-root-relative); omit when the feature owns no schema. */
  migrationsDir?: string;
}

/**
 * Ordered registry of features. The order is also the migration order: catalog
 * owns schema version 1, machines 2, and sales 3; reporting owns no schema, so
 * it carries no `migrationsDir` and contributes no migrations. Add one entry
 * per feature; leave `migrationsDir` unset when the feature owns no schema.
 */
export const features: readonly Feature[] = [
  {
    name: "catalog",
    register: catalog.register,
    migrationsDir: "src/features/catalog/repository/postgres/migrations",
  },
  {
    name: "machines",
    register: machines.register,
    migrationsDir: "src/features/machines/repository/postgres/migrations",
  },
  {
    name: "sales",
    register: sales.register,
    migrationsDir: "src/features/sales/repository/postgres/migrations",
  },
  {
    name: "reporting",
    register: reporting.register,
  },
];

/**
 * Wire every registered feature into the container in registry order. A
 * failure is wrapped with the feature name so the log line points at the
 * failing feature, mirroring Go's `RegisterAll`.
 */
export function registerAll(c: Container): void {
  for (const feature of features) {
    try {
      feature.register(c);
    } catch (err) {
      throw new Error(`register ${feature.name} feature failed`, { cause: err });
    }
  }
}

/**
 * Migrations of every registered feature that owns schema, in registry order.
 * The runner merges them into one namespace; deleting an entry removes its
 * migrations with it.
 */
export function migrationSources(): { feature: string; dir: string }[] {
  const sources: { feature: string; dir: string }[] = [];
  for (const feature of features) {
    if (feature.migrationsDir !== undefined) {
      sources.push({ feature: feature.name, dir: feature.migrationsDir });
    }
  }
  return sources;
}
