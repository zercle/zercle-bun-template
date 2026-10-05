/**
 * Sample vending machines and coin banks for tests. Mirrors the Go template's
 * `internal/testutil/fixtures/machines.go`: deterministic ids, fixed
 * timestamps, and a `newBank` helper that fills every denomination.
 */
import {
  type CoinBank,
  DENOMINATIONS,
  type Machine,
} from "../../features/machines/domain/machine.ts";

/** Fixed timestamp every fixture is stamped with (Go: 2026-01-01 UTC). */
export const FIXTURE_TIME = new Date("2026-01-01T00:00:00.000Z");

/** Default deterministic machine id, mirroring Go's fixed fixture UUID. */
export const FIXED_MACHINE_ID = "32345678-1234-1234-1234-123456789abc";

/**
 * Build a machine with fixed timestamps. `id` defaults to the fixed fixture id;
 * pass a distinct id when a single test needs several rows.
 */
export function newMachine(
  label: string,
  coinBank: CoinBank,
  id: string = FIXED_MACHINE_ID,
): Machine {
  return { id, label, coinBank, createdAt: FIXTURE_TIME, updatedAt: FIXTURE_TIME };
}

/** A bank holding ten of every supported denomination. */
export function newBank(): CoinBank {
  const bank: Record<number, number> = {};
  for (const denomination of DENOMINATIONS) {
    bank[denomination] = 10;
  }
  return bank;
}

/** Return the given values as a coin slice, for readable test inputs. */
export function coins(...values: number[]): number[] {
  return values;
}
