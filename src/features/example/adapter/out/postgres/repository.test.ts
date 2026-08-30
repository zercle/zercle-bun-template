/**
 * Unit tests for the example feature's repository. We supply a fake Drizzle
 * DB that records the chained query calls so we can assert the repository
 * builds the correct queries without touching a real database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrItemNotFound } from "../../../domain/errors.ts";
import { DrizzleItemRepository } from "./repository.ts";

interface RecordedChain {
  insertCalled: boolean;
  insertValues: unknown;
  selectRows: unknown[];
  whereId: unknown;
  limitN: number | undefined;
  listRows: unknown[];
  listLimit: number | undefined;
  listOffset: number | undefined;
}

function makeFakeDb(rows: unknown[] = []): { db: unknown; rec: RecordedChain } {
  const rec: RecordedChain = {
    insertCalled: false,
    insertValues: undefined,
    selectRows: rows,
    whereId: undefined,
    limitN: undefined,
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
          limit: vi.fn((n: number) => {
            rec.limitN = n;
            return Promise.resolve(rec.selectRows);
          }),
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

describe("DrizzleItemRepository", () => {
  let now: Date;
  beforeEach(() => {
    now = new Date("2026-01-01T00:00:00Z");
  });

  it("create inserts a row and returns the original item", async () => {
    const { db, rec } = makeFakeDb();
    const repo = new DrizzleItemRepository(db as never);
    const item = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "widget",
      createdAt: now,
      updatedAt: now,
    };
    const result = await repo.create(item);
    expect(result).toEqual(item);
    expect(rec.insertCalled).toBe(true);
    expect(rec.insertValues).toEqual(item);
  });

  it("getById returns the matching row mapped to the domain shape", async () => {
    const { db } = makeFakeDb([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "thing",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const repo = new DrizzleItemRepository(db as never);
    const result = await repo.getById("22222222-2222-2222-2222-222222222222");
    expect(result).toEqual({
      id: "22222222-2222-2222-2222-222222222222",
      name: "thing",
      createdAt: now,
      updatedAt: now,
    });
  });

  it("getById throws ErrItemNotFound when no row matches", async () => {
    const { db } = makeFakeDb([]);
    const repo = new DrizzleItemRepository(db as never);
    await expect(repo.getById("missing")).rejects.toBe(ErrItemNotFound);
  });

  it("list applies limit/offset and maps the rows", async () => {
    const rows = [
      {
        id: "a",
        name: "alpha",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "b",
        name: "beta",
        createdAt: now,
        updatedAt: now,
      },
    ];
    const { db, rec } = makeFakeDb(rows);
    const repo = new DrizzleItemRepository(db as never);
    const result = await repo.list(10, 20);
    expect(result).toEqual(rows);
    expect(rec.listLimit).toBe(10);
    expect(rec.listOffset).toBe(20);
  });
});
