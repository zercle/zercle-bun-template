/**
 * Purchase domain rules for the sales feature.
 *
 * Mirrors the Go template's `domain/purchase.go`: pure functions over the
 * catalog projection and the machine coin bank, with no persistence concerns.
 */
import { type CoinBank, cloneBank, makeChange, sumCoins, validateCoins } from "./coins.ts";
import { ErrInsufficientPayment, ErrOutOfStock } from "./errors.ts";

/** The durable outcome of a purchase. */
export interface PurchaseRecord {
  id: string;
  machineId: string;
  productId: string;
  priceCents: number;
  totalInsertedCents: number;
  changeCents: number;
  changeCoins: number[];
  purchasedAt: Date;
}

/**
 * The catalog projection the sales feature needs to price and guard a sale. It
 * carries no catalog behavior, only the fields a purchase decision reads.
 */
export interface SaleProduct {
  productId: string;
  priceCents: number;
  stock: number;
}

/**
 * Validates a coin payment against a product price and composes change from
 * the machine bank. It is pure: neither the price/stock inputs nor the bank are
 * mutated; the caller is responsible for persisting the sale and its coin
 * effects. `priceCents` is guaranteed positive by the catalog schema's CHECK
 * (price_cents > 0) constraint, so it is not re-validated here.
 *
 * Coins are validated before totals so an unsupported coin is rejected even
 * when the payment would otherwise be sufficient.
 */
export function purchase(
  priceCents: number,
  stock: number,
  bank: CoinBank,
  coins: number[],
): { change: number[]; remaining: CoinBank } {
  validateCoins(coins);
  const total = sumCoins(coins);
  if (total < priceCents) {
    throw new Error(
      `${ErrInsufficientPayment.message}: inserted ${total} cents, price ${priceCents} cents`,
      { cause: ErrInsufficientPayment },
    );
  }
  if (stock <= 0) {
    throw ErrOutOfStock;
  }
  const changeAmt = total - priceCents;
  if (changeAmt === 0) {
    return { change: [], remaining: cloneBank(bank) };
  }
  return makeChange(bank, changeAmt);
}
