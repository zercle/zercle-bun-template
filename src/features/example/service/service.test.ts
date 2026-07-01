// STUB FEATURE — delete src/features/example to start your project.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidName, ErrItemNotFound } from "../domain/errors.ts";
import type { Item } from "../domain/item.ts";
import type { ItemRepository } from "../domain/repository.ts";
import { ItemServiceImpl } from "./service.ts";

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

describe("ItemServiceImpl", () => {
  let repo: ItemRepository;
  let svc: ItemServiceImpl;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ItemServiceImpl(repo, {
      defaultPageSize: 20,
      maxPageSize: 100,
      maxNameLength: 255,
    });
  });

  describe("create", () => {
    it("returns a new item with trimmed name and uuid on valid input", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedItem("hello"));

      const item = await svc.create("  hello  ");

      expect(item.name).toBe("hello");
      expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
      expect(item.createdAt.getTime()).toBe(item.updatedAt.getTime());
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects an empty (whitespace-only) name with ErrInvalidName", async () => {
      await expect(svc.create("   ")).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a name longer than maxNameLength with ErrInvalidName", async () => {
      const long = "a".repeat(256);
      await expect(svc.create(long)).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects an empty string with ErrInvalidName", async () => {
      await expect(svc.create("")).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("counts length by Unicode code points, not UTF-16 units (matches Go's utf8.RuneCountInString)", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedItem("🎉🎉🎉"));

      // 3 emoji code points, but 6 UTF-16 code units (each surrogate pair = 2).
      // maxNameLength=255 would be exceeded by `name.length` (6 < 255 here,
      // so use a smaller limit to prove the point).
      const tight = new ItemServiceImpl(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 3,
      });
      const item = await tight.create("🎉🎉🎉");
      expect(item.name).toBe("🎉🎉🎉");
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects a multi-code-point name whose code-point count exceeds maxNameLength", async () => {
      const tight = new ItemServiceImpl(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 2,
      });
      // 3 emoji code points, 6 UTF-16 code units.
      await expect(tight.create("🎉🎉🎉")).rejects.toBe(ErrInvalidName);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("returns the item from the repository when found", async () => {
      const item = fixedItem("hello");
      vi.mocked(repo.getById).mockResolvedValueOnce(item);

      const got = await svc.get(item.id);
      expect(got).toBe(item);
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
      await svc.list(0, 0);
      expect(repo.list).toHaveBeenCalledWith(20, 0);
    });

    it("clamps limit > maxPageSize down to maxPageSize", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list(500, 0);
      expect(repo.list).toHaveBeenCalledWith(100, 0);
    });

    it("clamps negative offset to 0", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list(50, -5);
      expect(repo.list).toHaveBeenCalledWith(50, 0);
    });

    it("passes through valid limit and offset unchanged", async () => {
      vi.mocked(repo.list).mockResolvedValueOnce([]);
      await svc.list(25, 10);
      expect(repo.list).toHaveBeenCalledWith(25, 10);
    });
  });
});
