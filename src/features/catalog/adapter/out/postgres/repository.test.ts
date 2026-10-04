/**
 * Unit tests for the catalog feature's repository. We supply a fake Drizzle
 * DB that records the chained query calls so we can assert the repository
 * builds the correct queries without touching a real database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrProductNotFound } from "../../../domain/errors.ts";
import { DrizzleProductRepository } from "./repository.ts";

interface RecordedChain {
  insertCalled: boolean;
  insertValues: unknown;
  selectRows: unknown[];
  listRows: unknown[];
  listLimit: number | undefined;
  listOffset: number | undefined;
}

function makeFakeDb(rows: unknown[] = []): { db: unknown; rec: RecordedChain } {
  const rec: RecordedChain = {
    insertCalled: false,
    insertValues: undefined,
    selectRows: rows,
    listRows: rows,
    listLimit: undefined,
    listOffset: undefined,
  };
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((v: unknown) => {
        rec.insertCalled = true;
        rec.insertValues = v;
        return Promise.resolve();
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(rec.selectRows)),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn((n: number) => ({
            offset: vi.fn((o: number) => {
              rec.listLimit = n;
              rec.listOffset = o;
              return Promise.resolve(rec.listRows);
            }),
          })),
        })),
      })),
    })),
  };
  return { db, rec };
}

describe("DrizzleProductRepository", () => {
  let now: Date;
  beforeEach(() => {
    now = new Date("2026-01-01T00:00:00Z");
  });

  it("create inserts a row and returns the original product", async () => {
    const { db, rec } = makeFakeDb();
    const repo = new DrizzleProductRepository(db as never);
    const product = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "widget",
      priceCents: 250,
      stock: 3,
      createdAt: now,
      updatedAt: now,
    };

    const result = await repo.create(product);
    expect(result).toEqual(product);
    expect(rec.insertCalled).toBe(true);
    expect(rec.insertValues).toEqual(product);
  });

  it("getById returns the matching row mapped to the domain shape", async () => {
    const { db } = makeFakeDb([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "thing",
        priceCents: 100,
        stock: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const repo = new DrizzleProductRepository(db as never);
    const result = await repo.getById("22222222-2222-2222-2222-222222222222");
    expect(result).toEqual({
      id: "22222222-2222-2222-2222-222222222222",
      name: "thing",
      priceCents: 100,
      stock: 7,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("getById throws ErrProductNotFound when no row matches", async () => {
    const { db } = makeFakeDb([]);
    const repo = new DrizzleProductRepository(db as never);
    await expect(repo.getById("missing")).rejects.toBe(ErrProductNotFound);
  });

  it("list applies limit/offset and maps the rows", async () => {
    const rows = [
      { id: "a", name: "alpha", priceCents: 100, stock: 1, createdAt: now, updatedAt: now },
      { id: "b", name: "beta", priceCents: 200, stock: 2, createdAt: now, updatedAt: now },
    ];
    const { db, rec } = makeFakeDb(rows);
    const repo = new DrizzleProductRepository(db as never);
    const result = await repo.list(10, 20);
    expect(result).toEqual(rows);
    expect(rec.listLimit).toBe(10);
    expect(rec.listOffset).toBe(20);
  });
});
