import { describe, expect, it } from "vitest";
import { ErrMachineNotFound, ErrUnsupportedCoin } from "../domain/errors.ts";
import { addCoins, DENOMINATIONS, validateCoins } from "../domain/machine.ts";

describe("machines domain sentinels", () => {
  it("is exported and matchable by identity", () => {
    expect(ErrMachineNotFound).toBe(ErrMachineNotFound);
    expect(ErrUnsupportedCoin).toBe(ErrUnsupportedCoin);
  });
});

describe("validateCoins", () => {
  it("accepts all supported denominations and the empty list", () => {
    expect(() => validateCoins([...DENOMINATIONS])).not.toThrow();
    expect(() => validateCoins([])).not.toThrow();
  });

  it("throws ErrUnsupportedCoin naming the offending value", () => {
    expect(() => validateCoins([5, 7])).toThrow();
    try {
      validateCoins([5, 7]);
      expect.unreachable("expected validateCoins to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).cause).toBe(ErrUnsupportedCoin);
      expect((err as Error).message).toContain("7");
    }
  });
});

describe("addCoins", () => {
  it("returns a new bank with every coin added and never mutates the input", () => {
    const bank = { 5: 1, 25: 2 };
    const out = addCoins(bank, [5, 100]);

    expect(out).toEqual({ 5: 2, 25: 2, 100: 1 });
    // Input bank must not be mutated (copy-on-write, mirrors Go's CoinBank).
    expect(bank).toEqual({ 5: 1, 25: 2 });
    expect(out).not.toBe(bank);
  });
});
