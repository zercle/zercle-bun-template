/**
 * Use-case tests for the sales feature, driven by an in-memory repository fake.
 * Mirrors the Go template's `usecase/usecase_test.go`: the happy path with
 * change, exact payment, and every rejection path, plus the commit-time stock
 * race.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoinBank } from "../domain/coins.ts";
import {
  ErrExactChangeRequired,
  ErrInsufficientPayment,
  ErrInvalidID,
  ErrMachineNotFound,
  ErrOutOfStock,
  ErrProductNotFound,
} from "../domain/errors.ts";
import type { SalesRepository } from "../repository/repository.ts";
import { SalesUsecase } from "./usecase.ts";

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

function knownBank(): CoinBank {
  return { 5: 10, 10: 10, 25: 10, 50: 10, 100: 10 };
}

function makeRepo(): SalesRepository {
  return {
    getProduct: vi.fn(),
    getMachineBank: vi.fn(),
    commitPurchase: vi.fn(),
  };
}

describe("SalesUsecase", () => {
  let repo: SalesRepository;
  let svc: SalesUsecase;

  beforeEach(() => {
    repo = makeRepo();
    svc = new SalesUsecase(repo);
  });

  it("returns the wire response with change and commits the remaining bank", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 75,
      stock: 5,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());

    const resp = await svc.purchase({
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      coins: [100],
    });

    expect(resp.machine_id).toBe(MACHINE_ID);
    expect(resp.product_id).toBe(PRODUCT_ID);
    expect(resp.price_cents).toBe(75);
    expect(resp.total_inserted_cents).toBe(100);
    expect(resp.change_cents).toBe(25);
    expect(resp.change_coins).toEqual([25]);
    expect(resp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const call = vi.mocked(repo.commitPurchase).mock.calls[0];
    expect(call?.[0]).toBe(MACHINE_ID);
    expect(call?.[1]).toBe(PRODUCT_ID);
    const record = call?.[2];
    expect(record?.id).toBe(resp.id);
    expect(record?.priceCents).toBe(75);
    expect(record?.totalInsertedCents).toBe(100);
    expect(record?.changeCents).toBe(25);
    expect(record?.changeCoins).toEqual([25]);
    expect(new Date(resp.purchased_at).getTime()).toBe(record?.purchasedAt.getTime());
    // 25 is paid out of the bank, leaving nine of them.
    expect(call?.[3]).toEqual({ 5: 10, 10: 10, 25: 9, 50: 10, 100: 10 });
  });

  it("composes change greedily largest-first", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 65,
      stock: 5,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());

    const resp = await svc.purchase({
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      coins: [100],
    });
    expect(resp.change_coins).toEqual([25, 10]);
    expect(resp.change_cents).toBe(35);
  });

  it("returns empty change and an unchanged bank on exact payment", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 50,
      stock: 2,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());

    const resp = await svc.purchase({
      machine_id: MACHINE_ID,
      product_id: PRODUCT_ID,
      coins: [50],
    });
    expect(resp.change_cents).toBe(0);
    expect(resp.change_coins).toEqual([]);
    expect(vi.mocked(repo.commitPurchase).mock.calls[0]?.[3]).toEqual(knownBank());
  });

  it("propagates ErrExactChangeRequired when the bank cannot compose the change", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 40,
      stock: 5,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce({ 100: 1 });

    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [100] }),
    ).rejects.toBe(ErrExactChangeRequired);
    expect(repo.commitPurchase).not.toHaveBeenCalled();
  });

  it("rejects insufficient payment naming inserted vs price cents", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 100,
      stock: 5,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());

    const err = await svc
      .purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [25] })
      .then(
        () => undefined,
        (e: unknown) => e as Error,
      );
    expect(err?.message).toBe("insufficient payment: inserted 25 cents, price 100 cents");
    expect(err?.cause).toBe(ErrInsufficientPayment);
    expect(repo.commitPurchase).not.toHaveBeenCalled();
  });

  it("rejects an unsupported coin before any repository read", async () => {
    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [7] }),
    ).rejects.toThrow("unsupported coin: 7");
    expect(repo.getProduct).not.toHaveBeenCalled();
    expect(repo.getMachineBank).not.toHaveBeenCalled();
  });

  it("rejects a malformed machine_id with ErrInvalidID before any read", async () => {
    await expect(
      svc.purchase({ machine_id: "not-a-uuid", product_id: PRODUCT_ID, coins: [50] }),
    ).rejects.toBe(ErrInvalidID);
    expect(repo.getProduct).not.toHaveBeenCalled();
  });

  it("rejects a malformed product_id with ErrInvalidID before any read", async () => {
    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: "not-a-uuid", coins: [50] }),
    ).rejects.toBe(ErrInvalidID);
    expect(repo.getProduct).not.toHaveBeenCalled();
  });

  it("rejects an out-of-stock product", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 50,
      stock: 0,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());

    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    ).rejects.toBe(ErrOutOfStock);
    expect(repo.commitPurchase).not.toHaveBeenCalled();
  });

  it("propagates ErrProductNotFound from the product read", async () => {
    vi.mocked(repo.getProduct).mockRejectedValueOnce(ErrProductNotFound);
    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    ).rejects.toBe(ErrProductNotFound);
    expect(repo.getMachineBank).not.toHaveBeenCalled();
  });

  it("propagates ErrMachineNotFound from the bank read", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 50,
      stock: 5,
    });
    vi.mocked(repo.getMachineBank).mockRejectedValueOnce(ErrMachineNotFound);
    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    ).rejects.toBe(ErrMachineNotFound);
    expect(repo.commitPurchase).not.toHaveBeenCalled();
  });

  it("propagates ErrOutOfStock when the commit loses the stock race", async () => {
    vi.mocked(repo.getProduct).mockResolvedValueOnce({
      productId: PRODUCT_ID,
      priceCents: 50,
      stock: 1,
    });
    vi.mocked(repo.getMachineBank).mockResolvedValueOnce(knownBank());
    vi.mocked(repo.commitPurchase).mockRejectedValueOnce(ErrOutOfStock);

    await expect(
      svc.purchase({ machine_id: MACHINE_ID, product_id: PRODUCT_ID, coins: [50] }),
    ).rejects.toBe(ErrOutOfStock);
  });
});
