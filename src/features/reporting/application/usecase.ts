/**
 * Use-case orchestration for the reporting feature: clamps the requested
 * top-machines limit, rejects one above the configured maximum before any
 * repository call, aggregates the cross-feature totals, and maps them to the
 * wire contract. Depends only on `contract`, `domain`, `port`, and sibling
 * `application` modules.
 */
import type {
  MachineSales as MachineSalesWire,
  SummaryRequest,
  SummaryResponse,
} from "../contract/summary.ts";
import { ErrInvalidTopMachines } from "../domain/errors.ts";
import type { MachineSales, Overview } from "../domain/summary.ts";
import type { ReportingRepository } from "../port/repository.ts";
import type { ReportingService } from "./service.ts";

const DEFAULT_TOP_MACHINES_FALLBACK = 5;
const MAX_TOP_MACHINES_FALLBACK = 20;

/** Map the domain overview and leaderboard to their wire representation. */
function toSummaryResponse(overview: Overview, machines: MachineSales[]): SummaryResponse {
  return {
    catalog: { product_count: overview.productCount, total_stock: overview.totalStock },
    machines: {
      machine_count: overview.machineCount,
      total_coin_bank_cents: overview.totalBankCents,
    },
    sales: { purchase_count: overview.purchaseCount, revenue_cents: overview.revenueCents },
    top_machines: machines.map(
      (m): MachineSalesWire => ({
        machine_id: m.machineId,
        label: m.label,
        purchase_count: m.purchaseCount,
        revenue_cents: m.revenueCents,
      }),
    ),
  };
}

export class ReportingUsecase implements ReportingService {
  private readonly repo: ReportingRepository;
  private readonly defaultTopMachines: number;
  private readonly maxTopMachines: number;

  /**
   * The composition root always passes the configured bounds; the 5/20
   * fallbacks only apply when a caller passes a non-positive value (mirrors
   * Go's `NewUsecase`).
   */
  constructor(repo: ReportingRepository, defaultTopMachines: number, maxTopMachines: number) {
    this.repo = repo;
    this.defaultTopMachines =
      defaultTopMachines > 0 ? defaultTopMachines : DEFAULT_TOP_MACHINES_FALLBACK;
    this.maxTopMachines = maxTopMachines > 0 ? maxTopMachines : MAX_TOP_MACHINES_FALLBACK;
  }

  /**
   * Aggregates the cross-feature totals and the top machines into one report.
   * An absent or non-positive top-machines value uses the configured default;
   * a value above the configured maximum is rejected before any repository
   * call so an unbounded leaderboard never reaches the database.
   */
  async summary(req: SummaryRequest): Promise<SummaryResponse> {
    let top = req.top ?? 0;
    if (top <= 0) {
      top = this.defaultTopMachines;
    }
    if (top > this.maxTopMachines) {
      throw ErrInvalidTopMachines;
    }

    const overview = await this.repo.getOverview();
    const machines = await this.repo.getTopMachines(top);
    return toSummaryResponse(overview, machines);
  }
}
