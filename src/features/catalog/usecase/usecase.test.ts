/**
 * Unit tests for the catalog use case. The outbound port is a hand-written
 * fake (vi.fn methods) so we assert orchestration, validation, and
 * limit-clamping without a database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductResponse } from "../contract/create-product.ts";
import { ErrInvalidPrice, ErrInvalidProductName, ErrProductNotFound } from "../domain/errors.ts";
import type { Product } from "../domain/product.ts";
import type { ProductRepository } from "../repository/repository.ts";
import { ProductUsecase } from "./usecase.ts";

function toExpectedContract(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    price_cents: product.priceCents,
    stock: product.stock,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  };
}

function makeRepo(): ProductRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
  };
}

function fixedProduct(name: string): Product {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name,
    priceCents: 250,
    stock: 3,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
}

describe("ProductUsecase", () => {
  let repo: ProductRepository;
  let svc: ProductUsecase;

  beforeEach(() => {
    repo = makeRepo();
    svc = new ProductUsecase(repo, {
      defaultPageSize: 20,
      maxPageSize: 100,
      maxNameLength: 255,
    });
  });

  describe("create", () => {
    it("returns the wire response for a trimmed, valid product", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedProduct("widget"));

      const resp = await svc.create({ name: "  widget  ", price_cents: 250, stock: 3 });

      expect(resp.name).toBe("widget");
      expect(resp.price_cents).toBe(250);
      expect(resp.stock).toBe(3);
      expect(resp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      // The response must mirror the entity handed to the outbound port.
      const persisted = vi.mocked(repo.create).mock.calls[0]?.[0];
      expect(persisted).toBeDefined();
      expect(resp.id).toBe(persisted?.id);
      expect(new Date(resp.created_at).getTime()).toBe(persisted?.createdAt.getTime());
      expect(new Date(resp.updated_at).getTime()).toBe(persisted?.updatedAt.getTime());
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects an empty (whitespace-only) name with ErrInvalidProductName", async () => {
      await expect(svc.create({ name: "   ", price_cents: 100, stock: 0 })).rejects.toBe(
        ErrInvalidProductName,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a name longer than maxNameLength with ErrInvalidProductName", async () => {
      const long = "a".repeat(256);
      await expect(svc.create({ name: long, price_cents: 100, stock: 0 })).rejects.toBe(
        ErrInvalidProductName,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects an empty string with ErrInvalidProductName", async () => {
      await expect(svc.create({ name: "", price_cents: 100, stock: 0 })).rejects.toBe(
        ErrInvalidProductName,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("counts length by Unicode code points, not UTF-16 units (matches Go's utf8.RuneCountInString)", async () => {
      vi.mocked(repo.create).mockResolvedValueOnce(fixedProduct("🎉🎉🎉"));

      // 3 emoji code points, but 6 UTF-16 code units (each surrogate pair = 2).
      // maxNameLength=3 would be exceeded by `name.length` (6 > 3).
      const tight = new ProductUsecase(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 3,
      });
      const resp = await tight.create({ name: "🎉🎉🎉", price_cents: 100, stock: 0 });
      expect(resp.name).toBe("🎉🎉🎉");
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it("rejects a multi-code-point name whose code-point count exceeds maxNameLength", async () => {
      const tight = new ProductUsecase(repo, {
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 2,
      });
      // 3 emoji code points, 6 UTF-16 code units.
      await expect(tight.create({ name: "🎉🎉🎉", price_cents: 100, stock: 0 })).rejects.toBe(
        ErrInvalidProductName,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rejects a non-positive price with ErrInvalidPrice", async () => {
      await expect(svc.create({ name: "widget", price_cents: 0, stock: 0 })).rejects.toBe(
        ErrInvalidPrice,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("falls back to the built-in limits when configured bounds are <= 0", () => {
      const fallback = new ProductUsecase(repo, {
        defaultPageSize: 0,
        maxPageSize: 0,
        maxNameLength: 0,
      });
      expect(fallback.limits).toEqual({
        defaultPageSize: 20,
        maxPageSize: 100,
        maxNameLength: 255,
      });
    });
  });

  describe("get", () => {
    it("returns the wire response for the repository product", async () => {
      const product = fixedProduct("widget");
      vi.mocked(repo.getById).mockResolvedValueOnce(product);

      const resp = await svc.get(product.id);
      expect(resp).toEqual(toExpectedContract(product));
      expect(repo.getById).toHaveBeenCalledWith(product.id);
    });

    it("propagates ErrProductNotFound from the repository", async () => {
      vi.mocked(repo.getById).mockRejectedValueOnce(ErrProductNotFound);
      await expect(svc.get("missing")).rejects.toBe(ErrProductNotFound);
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

    it("maps repository products to the wire shape", async () => {
      const products = [fixedProduct("a"), fixedProduct("b")];
      vi.mocked(repo.list).mockResolvedValueOnce(products);

      const resp = await svc.list({ limit: 10 });
      expect(resp.products).toEqual(products.map(toExpectedContract));
    });
  });
});
