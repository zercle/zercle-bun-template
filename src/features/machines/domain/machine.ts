/**
 * Machines domain: the registered vending machine and its coin bank.
 *
 * CoinBank maps a denomination in cents to the number of such coins the
 * machine holds. It is read-only by convention: functions in this module never
 * mutate a bank they receive, they copy on write. Callers handing a bank to
 * another function must assume that function treats it as read-only.
 */
import { ErrUnsupportedCoin } from "./errors.ts";

/**
 * Denominations lists the coin values the machine accepts, in cents, ascending.
 * It is duplicated from the sales feature's supported denominations on purpose:
 * the architecture gates forbid importing another feature's domain package, and
 * the accepted set is small and stable, so a second declaration is cheaper than
 * a shared kernel that would couple the two features.
 */
export const DENOMINATIONS = [5, 10, 25, 50, 100] as const;

/** A machine's coin bank: denomination in cents -> count held. Read-only. */
export type CoinBank = Readonly<Record<number, number>>;

/** A registered vending machine and the coin bank it can pay change from. */
export interface Machine {
  id: string;
  label: string;
  coinBank: CoinBank;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate that every coin is an accepted denomination. The thrown error wraps
 * ErrUnsupportedCoin and names the offending value so a caller can still match
 * the sentinel via the cause chain while surfacing detail.
 */
export function validateCoins(coins: number[]): void {
  for (const coin of coins) {
    if (!isSupportedDenomination(coin)) {
      throw new Error(`${ErrUnsupportedCoin.message}: ${coin}`, { cause: ErrUnsupportedCoin });
    }
  }
}

/**
 * Return a new bank with every coin in `coins` added. The input bank is never
 * mutated.
 */
export function addCoins(bank: CoinBank, coins: number[]): CoinBank {
  const out: Record<number, number> = { ...bank };
  for (const coin of coins) {
    out[coin] = (out[coin] ?? 0) + 1;
  }
  return out;
}

/** Report whether `coin` is one of the accepted values. */
function isSupportedDenomination(coin: number): boolean {
  return DENOMINATIONS.some((denomination) => denomination === coin);
}
