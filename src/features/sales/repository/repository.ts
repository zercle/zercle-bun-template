/**
 * Outbound (driven) port of the sales feature. The usecase layer consumes
 * this interface; the Drizzle adapter under `repository/postgres` satisfies it
 * structurally.
 */
import type { CoinBank } from "../domain/coins.ts";
import type { PurchaseRecord, SaleProduct } from "../domain/purchase.ts";

export interface SalesRepository {
  /**
   * Reads the catalog projection for a product. A missing product maps to
   * `ErrProductNotFound`.
   */
  getProduct(productId: string): Promise<SaleProduct>;
  /**
   * Reads a machine's current coin bank. A missing machine maps to
   * `ErrMachineNotFound`.
   */
  getMachineBank(machineId: string): Promise<CoinBank>;
  /**
   * Records a completed sale atomically: it locks and decrements the product's
   * stock (guarding the read/commit race), replaces the machine's coin bank
   * with `bankAfter`, and inserts the purchase record. A missing product maps
   * to `ErrProductNotFound`, losing the stock race to `ErrOutOfStock`, and a
   * missing machine to `ErrMachineNotFound`.
   */
  commitPurchase(
    machineId: string,
    productId: string,
    record: PurchaseRecord,
    bankAfter: CoinBank,
  ): Promise<void>;
}
