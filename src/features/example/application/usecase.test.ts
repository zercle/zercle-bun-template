// STUB FEATURE — delete src/features/example to start your project.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemResponse } from "../contract/create-item.ts";
import { ErrInvalidName, ErrItemNotFound } from "../domain/errors.ts";
import type { Item } from "../domain/item.ts";
import type { ItemRepository } from "../port/repository.ts";
import { ItemUsecase } from "./usecase.ts";

function toExpectedContract(item: Item): ItemResponse {
  return {
    id: item.id,
    name: item.name,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}

function makeRepo(): ItemRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
  };
}

function fixedItem(name: string): Item {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

describe("ItemUsecase", () => {
  let repo: ItemRepository;
  let svc: ItemUsecase;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ItemUsecase(repo, {
      defaultPageSize: 20,
      maxPageSize: 100,
      maxNameLength: 255,
    });
  });

  describe("create", () => {
    it("returns the wire response for a trimmed, valid name", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedItem("hello"));

      const resp = await svc.create({ name: "  hello  " });

      expect(resp.name).toBe("hello");
      expect(resp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      // The response must mirror the entity handed to the outbound port.
      const persisted = vi.mocked(repo.create).mock.calls[0]?.[0];
      expect(persisted).toBeDefined();
      expect(resp.id).toBe(persisted?.id);
      expect(new Date(resp.created_at).getTime()).toBe(persisted?.createdAt.getTime());
      expect(new Date(resp.updated_at).getTime()).toBe(persisted?.updatedAt.getTime());
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects an empty (whitespace-only) name with ErrInvalidName", async () => {
      await expect(svc.create({ name: "   " })).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a name longer than maxNameLength with ErrInvalidName", async () => {
      const long = "a".repeat(256);
      await expect(svc.create({ name: long })).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects an empty string with ErrInvalidName", async () => {
      await expect(svc.create({ name: "" })).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("counts length by Unicode code points, not UTF-16 units (matches Go's utf8.RuneCountInString)", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedItem("🎉🎉🎉"));

      // 3 emoji code points, but 6 UTF-16 code units (each surrogate pair = 2).
      // maxNameLength=255 would be exceeded by `name.length` (6 < 255 here,
      // so use a smaller limit to prove the point).
      const tight = new ItemUsecase(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 3,
      });
      const resp = await tight.create({ name: "🎉🎉🎉" });
      expect(resp.name).toBe("🎉🎉🎉");
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects a multi-code-point name whose code-point count exceeds maxNameLength", async () => {
      const tight = new ItemUsecase(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 2,
      });
      // 3 emoji code points, 6 UTF-16 code units.
      await expect(tight.create({ name: "🎉🎉🎉" })).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("returns the wire response for the repository item", async () => {
      const item = fixedItem("hello");
      vi.mocked(repo.getById).mockResolvedValueOnce(item);

      const resp = await svc.get(item.id);
      expect(resp).toEqual(toExpectedContract(item));
      expect(repo.getById).toHaveBeenCalledWith(item.id);
    });

    it("propagates ErrItemNotFound from the repository", async () => {
      vi.mocked(repo.getById).mockRejectedValueOnce(ErrItemNotFound);
      await expect(svc.get("missing")).rejects.toBe(ErrItemNotFound);
    });
  });

  describe("list", () => {
    it("clamps limit <= 0 to defaultPageSize", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list({});
      expect(repo.list).toHaveBeenCalledWith(20, 0);
    });

    it("clamps limit > maxPageSize down to maxPageSize", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list({ limit: 500 });
      expect(repo.list).toHaveBeenCalledWith(100, 0);
    });

    it("clamps negative offset to 0", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list({ limit: 50, offset: -5 });
      expect(repo.list).toHaveBeenCalledWith(50, 0);
    });

    it("passes through valid limit and offset unchanged", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list({ limit: 25, offset: 10 });
      expect(repo.list).toHaveBeenCalledWith(25, 10);
    });

    it("maps repository items to the wire shape", async () => {
      const items = [fixedItem("a"), fixedItem("b")];
      vi.mocked(repo.list).mockResolvedValueOnce(items);

      const resp = await svc.list({ limit: 10 });
      expect(resp.items).toEqual(items.map(toExpectedContract));
    });
  });
});
