/**
 * Unit tests for the machines feature's repository. We supply a fake Drizzle
 * DB that records the chained query calls so we can assert the repository
 * builds the correct queries (including the SELECT ... FOR UPDATE lock) without
 * touching a real database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrMachineNotFound } from "../../domain/errors.ts";
import { DrizzleMachineRepository } from "./repository.ts";

interface RecordedChain {
  insertCalled: boolean;
  insertValues: unknown;
  limitN: number | undefined;
  listLimit: number | undefined;
  listOffset: number | undefined;
  lockStrength: string | undefined;
  updateSet: unknown;
  updateWhere: unknown;
  updateCalled: boolean;
}

function makeFakeDb(
  rows: unknown[] = [],
  txRows: unknown[] = [],
): { db: unknown; rec: RecordedChain } {
  const rec: RecordedChain = {
    insertCalled: false,
    insertValues: undefined,
    limitN: undefined,
    listLimit: undefined,
    listOffset: undefined,
    lockStrength: undefined,
    updateSet: undefined,
    updateWhere: undefined,
    updateCalled: false,
  };

  function selectBuilder(result: unknown[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn((n: number) => {
            rec.limitN = n;
            return Promise.resolve(result);
          }),
          for: vi.fn((strength: string) => {
            rec.lockStrength = strength;
            return {
              limit: vi.fn((n: number) => {
                rec.limitN = n;
                return Promise.resolve(result);
              }),
            };
          }),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn((n: number) => ({
            offset: vi.fn((o: number) => {
              rec.listLimit = n;
              rec.listOffset = o;
              return Promise.resolve(result);
            }),
          })),
        })),
      })),
    };
  }

  const tx = {
    select: () => selectBuilder(txRows),
    update: vi.fn(() => ({
      set: vi.fn((v: unknown) => {
        rec.updateCalled = true;
        rec.updateSet = v;
        return {
          where: vi.fn((w: unknown) => {
            rec.updateWhere = w;
            return Promise.resolve();
          }),
        };
      }),
    })),
  };

  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((v: unknown) => {
        rec.insertCalled = true;
        rec.insertValues = v;
        return Promise.resolve();
      }),
    })),
    select: () => selectBuilder(rows),
    transaction: vi.fn((cb: (tx: unknown) => Promise<void>) => cb(tx)),
  };
  return { db, rec };
}

describe("DrizzleMachineRepository", () => {
  let now: Date;
  beforeEach(() => {
    now = new Date("2026-01-01T00:00:00Z");
  });

  it("create inserts a row with a string-keyed bank and returns the original machine", async () => {
    const { db, rec } = makeFakeDb();
    const repo = new DrizzleMachineRepository(db as never);
    const machine = {
      id: "11111111-1111-1111-1111-111111111111",
      label: "widget",
      coinBank: { 5: 1, 25: 2 },
      createdAt: now,
      updatedAt: now,
    };
    const result = await repo.create(machine);
    expect(result).toEqual(machine);
    expect(rec.insertCalled).toBe(true);
    expect(rec.insertValues).toEqual({
      id: machine.id,
      label: "widget",
      coinBank: { "5": 1, "25": 2 },
      createdAt: now,
      updatedAt: now,
    });
  });

  it("getById maps a string-keyed JSONB bank back to the numeric domain bank", async () => {
    const { db } = makeFakeDb([
      {
        id: "22222222-2222-2222-2222-222222222222",
        label: "thing",
        coinBank: { "5": 10, "25": 4 },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const repo = new DrizzleMachineRepository(db as never);
    const result = await repo.getById("22222222-2222-2222-2222-222222222222");
    expect(result).toEqual({
      id: "22222222-2222-2222-2222-222222222222",
      label: "thing",
      coinBank: { 5: 10, 25: 4 },
      createdAt: now,
      updatedAt: now,
    });
  });

  it("getById throws ErrMachineNotFound when no row matches", async () => {
    const { db } = makeFakeDb([]);
    const repo = new DrizzleMachineRepository(db as never);
    await expect(repo.getById("missing")).rejects.toBe(ErrMachineNotFound);
  });

  it("list applies limit/offset and maps the rows", async () => {
    const rows = [
      { id: "a", label: "alpha", coinBank: { "5": 1 }, createdAt: now, updatedAt: now },
      { id: "b", label: "beta", coinBank: {}, createdAt: now, updatedAt: now },
    ];
    const { db, rec } = makeFakeDb(rows);
    const repo = new DrizzleMachineRepository(db as never);
    const result = await repo.list(10, 20);
    expect(result).toEqual([
      { id: "a", label: "alpha", coinBank: { 5: 1 }, createdAt: now, updatedAt: now },
      { id: "b", label: "beta", coinBank: {}, createdAt: now, updatedAt: now },
    ]);
    expect(rec.listLimit).toBe(10);
    expect(rec.listOffset).toBe(20);
  });

  it("restockBank locks the row FOR UPDATE then writes the combined bank", async () => {
    const { db, rec } = makeFakeDb(
      [],
      [
        {
          id: "a",
          label: "restock",
          coinBank: { "5": 1, "25": 2 },
          createdAt: now,
          updatedAt: now,
        },
      ],
    );
    const repo = new DrizzleMachineRepository(db as never);

    await repo.restockBank("11111111-1111-4111-8111-111111111111", [5, 100]);

    expect(rec.lockStrength).toBe("update");
    expect(rec.updateCalled).toBe(true);
    expect(rec.updateSet).toEqual({
      coinBank: { "5": 2, "25": 2, "100": 1 },
      updatedAt: expect.any(Date),
    });
  });

  it("restockBank throws ErrMachineNotFound when the row is absent", async () => {
    const { db, rec } = makeFakeDb([], []);
    const repo = new DrizzleMachineRepository(db as never);

    await expect(repo.restockBank("11111111-1111-4111-8111-111111111111", [5])).rejects.toBe(
      ErrMachineNotFound,
    );
    expect(rec.updateCalled).toBe(false);
  });
});
