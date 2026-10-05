/**
 * Use-case orchestration for the sales feature: validates the request,
 * applies the pure purchase domain rules, persists the sale atomically via the
 * outbound repository, and maps the result to the wire contract. Depends only on
 * `contract`, `domain`, `repository`, and sibling `usecase` modules.
 */
import type { PurchaseRequest, PurchaseResponse } from "../contract/purchase.ts";
import { sumCoins, validateCoins } from "../domain/coins.ts";
import { ErrInvalidID } from "../domain/errors.ts";
import { type PurchaseRecord, purchase } from "../domain/purchase.ts";
import type { SalesRepository } from "../repository/repository.ts";
import type { SalesService } from "./service.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map a domain purchase record to its wire representation (RFC3339 timestamp). */
function toPurchaseResponse(record: PurchaseRecord): PurchaseResponse {
  return {
    id: record.id,
    machine_id: record.machineId,
    product_id: record.productId,
    price_cents: record.priceCents,
    total_inserted_cents: record.totalInsertedCents,
    change_cents: record.changeCents,
    change_coins: record.changeCoins,
    purchased_at: record.purchasedAt.toISOString(),
  };
}

export class SalesUsecase implements SalesService {
  constructor(private readonly repo: SalesRepository) {}

  /**
   * Validates a coin payment, composes change from the machine bank, records
   * the sale atomically, and returns its wire form.
   *
   * Steps run cheapest-first and fail fast: the two ids are parsed before any
   * repository call, and the coins are validated against the domain before a
   * read, so a malformed request never reaches the database. `purchase` then
   * decides insufficiency, stock, and exact-change against the prices and bank
   * actually read, and `commitPurchase` re-checks stock under a lock so a
   * concurrent sale that drained the stock loses the race with `ErrOutOfStock`.
   */
  async purchase(req: PurchaseRequest): Promise<PurchaseResponse> {
    if (!UUID_RE.test(req.machine_id) || !UUID_RE.test(req.product_id)) {
      throw ErrInvalidID;
    }
    validateCoins(req.coins);

    const product = await this.repo.getProduct(req.product_id);
    const bank = await this.repo.getMachineBank(req.machine_id);

    const { change, remaining } = purchase(product.priceCents, product.stock, bank, req.coins);

    const record: PurchaseRecord = {
      id: crypto.randomUUID(),
      machineId: req.machine_id,
      productId: req.product_id,
      priceCents: product.priceCents,
      totalInsertedCents: sumCoins(req.coins),
      changeCents: sumCoins(change),
      changeCoins: change,
      purchasedAt: new Date(),
    };

    await this.repo.commitPurchase(req.machine_id, req.product_id, record, remaining);

    return toPurchaseResponse(record);
  }
}
