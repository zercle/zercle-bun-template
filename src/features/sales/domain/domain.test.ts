/**
 * Domain rule tests for the sales feature. Mirrors the Go template's
 * `domain/domain_test.go`: sentinel identity, coin validation, exact greedy
 * change, and the purchase decision order.
 */
import { describe, expect, it } from "vitest";
import { type CoinBank, cloneBank, makeChange, sumCoins, validateCoins } from "./coins.ts";
import { ErrExactChangeRequired, ErrInsufficientPayment, ErrUnsupportedCoin } from "./errors.ts";
import { purchase } from "./purchase.ts";

const fullBank: CoinBank = { 5: 10, 10: 10, 25: 10, 50: 10, 100: 10 };

/** Capture a thrown error so its `cause` chain can be asserted. */
function capture(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected the call to throw");
}

describe("validateCoins", () => {
  it("accepts every supported denomination and the empty list", () => {
    expect(() => validateCoins([5, 10, 25, 50, 100])).not.toThrow();
    expect(() => validateCoins([])).not.toThrow();
    expect(() => validateCoins([5, 100, 25])).not.toThrow();
  });

  it("rejects an unsupported coin, naming the value and wrapping the sentinel", () => {
    const err = capture(() => validateCoins([5, 7]));
    expect(err.message).toBe("unsupported coin: 7");
    expect(err.cause).toBe(ErrUnsupportedCoin);
  });
});

describe("sumCoins", () => {
  it("sums an empty list to zero", () => {
    expect(sumCoins([])).toBe(0);
  });

  it("sums mixed denominations", () => {
    expect(sumCoins([100, 50, 10, 5])).toBe(165);
  });
});

describe("cloneBank", () => {
  it("is a deep copy: mutating the clone leaves the original untouched", () => {
    const bank: Record<number, number> = { 5: 2, 25: 1 };
    const clone = cloneBank(bank) as Record<number, number>;
    expect(clone).toEqual(bank);
    clone[5] = 99;
    expect(bank[5]).toBe(2);
  });
});

describe("makeChange", () => {
  const cases: Array<{
    name: string;
    bank: CoinBank;
    amount: number;
    want?: number[];
    remaining?: CoinBank;
  }> = [
    {
      name: "65 uses 50 10 5",
      bank: fullBank,
      amount: 65,
      want: [50, 10, 5],
      remaining: { 5: 9, 10: 9, 25: 10, 50: 9, 100: 10 },
    },
    {
      name: "40 uses 25 10 5",
      bank: fullBank,
      amount: 40,
      want: [25, 10, 5],
      remaining: { 5: 9, 10: 9, 25: 9, 50: 10, 100: 10 },
    },
    {
      name: "15 uses 10 5",
      bank: fullBank,
      amount: 15,
      want: [10, 5],
      remaining: { 5: 9, 10: 9, 25: 10, 50: 10, 100: 10 },
    },
    {
      name: "30 uses 25 5",
      bank: fullBank,
      amount: 30,
      want: [25, 5],
      remaining: { 5: 9, 10: 10, 25: 9, 50: 10, 100: 10 },
    },
    {
      name: "zero returns empty change and an equal bank",
      bank: fullBank,
      amount: 0,
      want: [],
      remaining: fullBank,
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const before = cloneBank(tc.bank);
      const { change, remaining } = makeChange(tc.bank, tc.amount);
      expect(change).toEqual(tc.want);
      expect(remaining).toEqual(tc.remaining);
      expect(sumCoins(change)).toBe(tc.amount);
      expect(tc.bank).toEqual(before);
    });
  }

  it("throws ErrExactChangeRequired when the amount cannot be composed", () => {
    expect(() => makeChange(fullBank, 3)).toThrow(ErrExactChangeRequired);
    expect(() => makeChange({ 100: 1 }, 40)).toThrow(ErrExactChangeRequired);
  });

  it("does not mutate the input bank on failure", () => {
    const bank: CoinBank = { 100: 1 };
    expect(() => makeChange(bank, 40)).toThrow(ErrExactChangeRequired);
    expect(bank).toEqual({ 100: 1 });
  });
});

describe("purchase", () => {
  it("returns change for an overpayment", () => {
    const { change, remaining } = purchase(100, 5, fullBank, [100, 25, 10]);
    expect(change).toEqual([25, 10]);
    expect(remaining).toEqual({ 5: 10, 10: 9, 25: 9, 50: 10, 100: 10 });
  });

  it("returns no change for an exact payment and an equal bank copy", () => {
    const { change, remaining } = purchase(100, 5, fullBank, [100]);
    expect(change).toEqual([]);
    expect(remaining).toEqual(fullBank);
  });

  it("rejects insufficient payment, naming inserted vs price cents", () => {
    const err = capture(() => purchase(100, 5, fullBank, [50]));
    expect(err.message).toBe("insufficient payment: inserted 50 cents, price 100 cents");
    expect(err.cause).toBe(ErrInsufficientPayment);
  });

  it("rejects an out-of-stock product", () => {
    expect(() => purchase(100, 0, fullBank, [100])).toThrow("product out of stock");
  });

  it("rejects an unsupported coin before considering totals", () => {
    // Payment is otherwise sufficient; the unsupported coin must still win.
    const err = capture(() => purchase(100, 5, fullBank, [100, 7]));
    expect(err.message).toBe("unsupported coin: 7");
    expect(err.cause).toBe(ErrUnsupportedCoin);
  });
});
