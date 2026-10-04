/**
 * Coin denominations and change-making for the sales feature.
 *
 * Mirrors the Go template's `domain/coins.go`. The coin helpers are
 * deliberately duplicated here rather than imported from the machines
 * feature: features never depend on one another (Go duplicates them too).
 */
import { ErrExactChangeRequired, ErrUnsupportedCoin } from "./errors.ts";

/**
 * SupportedDenominations lists the coin values the machine accepts, in cents,
 * ascending. It is a sorted slice rather than a set so `makeChange` can iterate
 * it largest-first; membership is a five-element scan, so no parallel set is
 * kept that could drift from the list.
 */
export const SupportedDenominations = [5, 10, 25, 50, 100];

/**
 * CoinBank maps a denomination in cents to the number of coins available for
 * change. It is a reference type, so callers who hand a bank to another
 * function must assume that function treats it as read-only; the functions in
 * this module never mutate a bank they receive.
 */
export type CoinBank = Readonly<Record<number, number>>;

/**
 * Returns a deep copy of the bank. A plain assignment would alias the
 * underlying object, letting a later write in one place silently change the
 * other, so every function that needs to modify a bank copies it first.
 */
export function cloneBank(bank: CoinBank): CoinBank {
  return { ...bank };
}

/**
 * Throws when any coin is not an accepted denomination. The thrown error wraps
 * `ErrUnsupportedCoin` and names the offending value so a caller can still
 * match the sentinel through its `cause` while surfacing detail.
 */
export function validateCoins(coins: number[]): void {
  for (const coin of coins) {
    if (!isSupportedDenomination(coin)) {
      throw new Error(`${ErrUnsupportedCoin.message}: ${coin}`, { cause: ErrUnsupportedCoin });
    }
  }
}

/** Returns the total value of coins in cents. */
export function sumCoins(coins: number[]): number {
  let total = 0;
  for (const coin of coins) {
    total += coin;
  }
  return total;
}

/**
 * Composes `amount` from `bank` using the fewest coins and returns the coins
 * used alongside the bank with those coins removed. The input bank is never
 * mutated. A non-positive amount yields empty change and an equal bank copy
 * (it cannot throw `ErrExactChangeRequired`); a machine that cannot pay out
 * exactly must refuse the sale.
 *
 * The denominations {5, 10, 25, 50, 100} form a canonical coin system, so
 * greedily taking the largest coin that still fits always composes the exact
 * amount whenever one exists; this is why a simple greedy pass is correct here
 * rather than requiring dynamic programming.
 */
export function makeChange(
  bank: CoinBank,
  amount: number,
): { change: number[]; remaining: CoinBank } {
  if (amount <= 0) {
    return { change: [], remaining: cloneBank(bank) };
  }
  const remaining: Record<number, number> = { ...bank };
  const change: number[] = [];
  let left = amount;
  for (const denom of [...SupportedDenominations].reverse()) {
    let take = Math.floor(left / denom);
    const have = remaining[denom] ?? 0;
    if (have < take) {
      take = have;
    }
    if (take <= 0) {
      continue;
    }
    for (let i = 0; i < take; i++) {
      change.push(denom);
    }
    remaining[denom] = have - take;
    left -= take * denom;
    if (left === 0) {
      break;
    }
  }
  if (left !== 0) {
    throw ErrExactChangeRequired;
  }
  return { change, remaining };
}

/** Reports whether `coin` is one of the accepted values. */
function isSupportedDenomination(coin: number): boolean {
  return SupportedDenominations.includes(coin);
}
