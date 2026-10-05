/**
 * Use-case tests for the reporting feature, driven by an in-memory repository
 * fake. The default fallback, the configurable upper bound (enforced before
 * any repository call), and the overview/leaderboard mapping are pinned here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidTopMachines } from "../domain/errors.ts";
import type { MachineSales, Overview } from "../domain/summary.ts";
import type { ReportingRepository } from "../repository/repository.ts";
import { ReportingUsecase } from "./usecase.ts";

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";

function zeroOverview(): Overview {
  return {
    productCount: 0,
    totalStock: 0,
    machineCount: 0,
    totalBankCents: 0,
    purchaseCount: 0,
    revenueCents: 0,
  };
}

function makeRepo(): ReportingRepository {
  return { getOverview: vi.fn(), getTopMachines: vi.fn() };
}

describe("ReportingUsecase", () => {
  let repo: ReportingRepository;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("uses the configured default when top is absent", async () => {
    vi.mocked(repo.getOverview).mockResolvedValueOnce(zeroOverview());
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce([]);

    const svc = new ReportingUsecase(repo, 5, 20);
    await svc.summary({});

    expect(repo.getTopMachines).toHaveBeenCalledWith(5);
  });

  it("uses the configured default when top is 0", async () => {
    vi.mocked(repo.getOverview).mockResolvedValueOnce(zeroOverview());
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce([]);

    const svc = new ReportingUsecase(repo, 7, 20);
    await svc.summary({ top: 0 });

    expect(repo.getTopMachines).toHaveBeenCalledWith(7);
  });

  it("passes an explicit in-range top through to the repository", async () => {
    vi.mocked(repo.getOverview).mockResolvedValueOnce(zeroOverview());
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce([]);

    const svc = new ReportingUsecase(repo, 5, 20);
    await svc.summary({ top: 3 });

    expect(repo.getTopMachines).toHaveBeenCalledWith(3);
  });

  it("rejects a top above the configured maximum before any repository call", async () => {
    const svc = new ReportingUsecase(repo, 5, 20);
    await expect(svc.summary({ top: 21 })).rejects.toBe(ErrInvalidTopMachines);
    expect(repo.getOverview).not.toHaveBeenCalled();
    expect(repo.getTopMachines).not.toHaveBeenCalled();
  });

  it("maps the overview and leaderboard to the wire response", async () => {
    const overview: Overview = {
      productCount: 2,
      totalStock: 9,
      machineCount: 1,
      totalBankCents: 125,
      purchaseCount: 3,
      revenueCents: 300,
    };
    const machines: MachineSales[] = [
      { machineId: MACHINE_ID, label: "A", purchaseCount: 3, revenueCents: 300 },
    ];
    vi.mocked(repo.getOverview).mockResolvedValueOnce(overview);
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce(machines);

    const svc = new ReportingUsecase(repo, 5, 20);
    const resp = await svc.summary({ top: 1 });

    expect(resp).toEqual({
      catalog: { product_count: 2, total_stock: 9 },
      machines: { machine_count: 1, total_coin_bank_cents: 125 },
      sales: { purchase_count: 3, revenue_cents: 300 },
      top_machines: [{ machine_id: MACHINE_ID, label: "A", purchase_count: 3, revenue_cents: 300 }],
    });
  });

  it("maps an empty leaderboard to an empty top_machines array", async () => {
    vi.mocked(repo.getOverview).mockResolvedValueOnce(zeroOverview());
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce([]);

    const svc = new ReportingUsecase(repo, 5, 20);
    const resp = await svc.summary({});

    expect(resp.top_machines).toEqual([]);
  });

  it("falls back to 5/20 when the configured bounds are non-positive", async () => {
    vi.mocked(repo.getOverview).mockResolvedValueOnce(zeroOverview());
    vi.mocked(repo.getTopMachines).mockResolvedValueOnce([]);

    const svc = new ReportingUsecase(repo, 0, 0);
    await svc.summary({});
    expect(repo.getTopMachines).toHaveBeenCalledWith(5);

    await expect(svc.summary({ top: 21 })).rejects.toBe(ErrInvalidTopMachines);
  });

  it("propagates repository errors", async () => {
    vi.mocked(repo.getOverview).mockRejectedValueOnce(new Error("db down"));

    const svc = new ReportingUsecase(repo, 5, 20);
    await expect(svc.summary({})).rejects.toThrow("db down");
    expect(repo.getTopMachines).not.toHaveBeenCalled();
  });
});
