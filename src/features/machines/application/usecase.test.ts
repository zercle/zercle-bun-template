import { describe, expect, it, vi } from "vitest";
import {
  ErrInvalidID,
  ErrInvalidMachineLabel,
  ErrMachineNotFound,
  ErrUnsupportedCoin,
} from "../domain/errors.ts";
import { addCoins, type Machine } from "../domain/machine.ts";
import type { MachineRepository } from "../port/repository.ts";
import { type MachineServiceLimits, MachineUsecase } from "./usecase.ts";

function fixedLimits(overrides: Partial<MachineServiceLimits> = {}): MachineServiceLimits {
  return {
    defaultPageSize: 20,
    maxPageSize: 100,
    maxLabelLength: 255,
    ...overrides,
  };
}

function fixedMachine(
  label: string,
  coinBank: Machine["coinBank"] = {},
  id = "11111111-1111-4111-8111-111111111111",
): Machine {
  return {
    id,
    label,
    coinBank,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

/** In-memory repository: restock mutates the store, so a re-read sees new coins. */
class InMemoryMachineRepository implements MachineRepository {
  readonly store = new Map<string, Machine>();

  create(machine: Machine): Promise<Machine> {
    this.store.set(machine.id, machine);
    return Promise.resolve(machine);
  }

  getById(id: string): Promise<Machine> {
    const machine = this.store.get(id);
    if (machine === undefined) {
      return Promise.reject(ErrMachineNotFound);
    }
    return Promise.resolve(machine);
  }

  list(limit: number, offset: number): Promise<Machine[]> {
    return Promise.resolve([...this.store.values()].slice(offset, offset + limit));
  }

  restockBank(id: string, coins: number[]): Promise<void> {
    const machine = this.store.get(id);
    if (machine === undefined) {
      return Promise.reject(ErrMachineNotFound);
    }
    this.store.set(id, {
      ...machine,
      coinBank: addCoins(machine.coinBank, coins),
      updatedAt: new Date(),
    });
    return Promise.resolve();
  }
}

/** Await a promise expected to reject, returning its rejection reason. */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  return promise.then(
    () => {
      throw new Error("expected promise to reject");
    },
    (err: unknown) => err as Error,
  );
}

describe("MachineUsecase", () => {
  describe("create", () => {
    it("trims the label, folds initial coins into a new bank, and returns the wire response", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      const resp = await svc.create({ label: "  front  ", initial_coins: [5, 25, 25] });

      expect(resp.label).toBe("front");
      expect(resp.coin_bank).toEqual({ "5": 1, "25": 2 });
      expect(resp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      // The response must mirror the entity handed to the outbound port.
      const persisted = repo.store.get(resp.id);
      expect(persisted?.label).toBe("front");
      expect(persisted?.coinBank).toEqual({ 5: 1, 25: 2 });
    });

    it("defaults the coin bank to empty when no initial coins are given", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      const resp = await svc.create({ label: "front" });

      expect(resp.coin_bank).toEqual({});
    });

    it("rejects an empty (whitespace-only) label with ErrInvalidMachineLabel", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      await expect(svc.create({ label: "   " })).rejects.toBe(ErrInvalidMachineLabel);
      expect(repo.store.size).toBe(0);
    });

    it("rejects a label longer than maxLabelLength with ErrInvalidMachineLabel", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits({ maxLabelLength: 3 }));

      await expect(svc.create({ label: "abcd" })).rejects.toBe(ErrInvalidMachineLabel);
      expect(repo.store.size).toBe(0);
    });

    it("counts length by Unicode code points, not UTF-16 units (matches Go's utf8.RuneCountInString)", async () => {
      const repo = new InMemoryMachineRepository();
      const tight = new MachineUsecase(repo, fixedLimits({ maxLabelLength: 3 }));

      const resp = await tight.create({ label: "🎉🎉🎉" });
      expect(resp.label).toBe("🎉🎉🎉");

      const tooTight = new MachineUsecase(repo, fixedLimits({ maxLabelLength: 2 }));
      await expect(tooTight.create({ label: "🎉🎉🎉" })).rejects.toBe(ErrInvalidMachineLabel);
    });

    it("rejects an unsupported initial coin with ErrUnsupportedCoin", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      const err = await rejectionOf(svc.create({ label: "front", initial_coins: [7] }));

      expect(err.cause).toBe(ErrUnsupportedCoin);
      expect(repo.store.size).toBe(0);
    });
  });

  describe("get", () => {
    it("returns the wire response for the stored machine", async () => {
      const repo = new InMemoryMachineRepository();
      const machine = fixedMachine("found", { 25: 3 });
      repo.store.set(machine.id, machine);
      const svc = new MachineUsecase(repo, fixedLimits());

      const resp = await svc.get(machine.id);

      expect(resp.id).toBe(machine.id);
      expect(resp.label).toBe("found");
      expect(resp.coin_bank).toEqual({ "25": 3 });
    });

    it("propagates ErrMachineNotFound from the repository", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      await expect(svc.get("missing")).rejects.toBe(ErrMachineNotFound);
    });
  });

  describe("list", () => {
    it("clamps limit <= 0 to defaultPageSize", async () => {
      const repo = new InMemoryMachineRepository();
      const spy = vi.spyOn(repo, "list");
      const svc = new MachineUsecase(repo, fixedLimits());

      await svc.list({});
      expect(spy).toHaveBeenCalledWith(20, 0);
    });

    it("clamps limit > maxPageSize down to maxPageSize", async () => {
      const repo = new InMemoryMachineRepository();
      const spy = vi.spyOn(repo, "list");
      const svc = new MachineUsecase(repo, fixedLimits({ maxPageSize: 50 }));

      await svc.list({ limit: 999 });
      expect(spy).toHaveBeenCalledWith(50, 0);
    });

    it("clamps negative offset to 0", async () => {
      const repo = new InMemoryMachineRepository();
      const spy = vi.spyOn(repo, "list");
      const svc = new MachineUsecase(repo, fixedLimits());

      await svc.list({ limit: 50, offset: -5 });
      expect(spy).toHaveBeenCalledWith(50, 0);
    });

    it("passes through valid limit and offset unchanged", async () => {
      const repo = new InMemoryMachineRepository();
      const spy = vi.spyOn(repo, "list");
      const svc = new MachineUsecase(repo, fixedLimits());

      await svc.list({ limit: 25, offset: 10 });
      expect(spy).toHaveBeenCalledWith(25, 10);
    });

    it("maps stored machines to the wire shape", async () => {
      const repo = new InMemoryMachineRepository();
      const a = fixedMachine("a", { 5: 1 }, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
      const b = fixedMachine("b", { 100: 2 }, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
      repo.store.set(a.id, a);
      repo.store.set(b.id, b);
      const svc = new MachineUsecase(repo, fixedLimits());

      const resp = await svc.list({ limit: 10 });

      expect(resp.machines).toHaveLength(2);
      expect(resp.machines[0]?.coin_bank).toEqual({ "5": 1 });
      expect(resp.machines[1]?.coin_bank).toEqual({ "100": 2 });
    });
  });

  describe("restockBank", () => {
    it("validates, restocks, then re-reads so the response reflects the stored bank", async () => {
      const repo = new InMemoryMachineRepository();
      const machine = fixedMachine("front", { 5: 1, 25: 2 });
      repo.store.set(machine.id, machine);
      const restockSpy = vi.spyOn(repo, "restockBank");
      const readSpy = vi.spyOn(repo, "getById");
      const svc = new MachineUsecase(repo, fixedLimits());

      const resp = await svc.restockBank(machine.id, { coins: [25] });

      expect(restockSpy).toHaveBeenCalledWith(machine.id, [25]);
      // The returned bank is the fresh read, not a locally composed map.
      expect(readSpy).toHaveBeenCalledWith(machine.id);
      expect(resp.coin_bank).toEqual({ "5": 1, "25": 3 });
      expect(restockSpy.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
        readSpy.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
      );
    });

    it("rejects an invalid id with ErrInvalidID before touching the repository", async () => {
      const repo = new InMemoryMachineRepository();
      const restockSpy = vi.spyOn(repo, "restockBank");
      const svc = new MachineUsecase(repo, fixedLimits());

      await expect(svc.restockBank("not-a-uuid", { coins: [25] })).rejects.toBe(ErrInvalidID);
      expect(restockSpy).not.toHaveBeenCalled();
    });

    it("rejects an unsupported coin with ErrUnsupportedCoin before touching the repository", async () => {
      const repo = new InMemoryMachineRepository();
      const restockSpy = vi.spyOn(repo, "restockBank");
      const svc = new MachineUsecase(repo, fixedLimits());

      const err = await rejectionOf(
        svc.restockBank("11111111-1111-4111-8111-111111111111", { coins: [7] }),
      );

      expect(err.cause).toBe(ErrUnsupportedCoin);
      expect(restockSpy).not.toHaveBeenCalled();
    });

    it("propagates ErrMachineNotFound when the machine is missing", async () => {
      const repo = new InMemoryMachineRepository();
      const svc = new MachineUsecase(repo, fixedLimits());

      await expect(
        svc.restockBank("11111111-1111-4111-8111-111111111111", { coins: [25] }),
      ).rejects.toBe(ErrMachineNotFound);
    });
  });
});
