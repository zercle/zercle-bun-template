/**
 * Driven adapter: Drizzle/Postgres persistence for the sales feature.
 * Satisfies the feature's `SalesRepository` interface structurally and translates
 * between storage rows and domain entities.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import type { DB } from "../../../../infrastructure/db/index.ts";
import type { CoinBank } from "../../domain/coins.ts";
import { ErrMachineNotFound, ErrOutOfStock, ErrProductNotFound } from "../../domain/errors.ts";
import type { PurchaseRecord, SaleProduct } from "../../domain/purchase.ts";
import type { SalesRepository } from "../repository.ts";
import { catalogProductsRef, machinesRef } from "./refs.ts";
import { salesPurchases } from "./schema.ts";

/** Convert the jsonb column's string-keyed record into the domain CoinBank. */
function toCoinBank(raw: Record<string, number>): CoinBank {
  const bank: Record<number, number> = {};
  for (const [denom, count] of Object.entries(raw)) {
    bank[Number(denom)] = count;
  }
  return bank;
}

/** Convert the domain CoinBank into the jsonb column's string-keyed record. */
function toJsonBank(bank: CoinBank): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [denom, count] of Object.entries(bank)) {
    out[String(denom)] = count;
  }
  return out;
}

export class DrizzleSalesRepository implements SalesRepository {
  constructor(private readonly db: DB) {}

  /**
   * Reads the catalog projection for a product. A missing row maps to
   * `ErrProductNotFound`.
   */
  async getProduct(productId: string): Promise<SaleProduct> {
    const rows = await this.db
      .select({
        productId: catalogProductsRef.id,
        priceCents: catalogProductsRef.priceCents,
        stock: catalogProductsRef.stock,
      })
      .from(catalogProductsRef)
      .where(eq(catalogProductsRef.id, productId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw ErrProductNotFound;
    }
    return row;
  }

  /**
   * Reads a machine's current coin bank. A missing row maps to
   * `ErrMachineNotFound`.
   */
  async getMachineBank(machineId: string): Promise<CoinBank> {
    const rows = await this.db
      .select({ coinBank: machinesRef.coinBank })
      .from(machinesRef)
      .where(eq(machinesRef.id, machineId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw ErrMachineNotFound;
    }
    return toCoinBank(row.coinBank);
  }

  /**
   * Atomically records a purchase and applies its effects: the product's stock
   * is decremented, the machine's coin bank is replaced with `bankAfter`, and
   * the purchase record is inserted. The product row is locked with
   * SELECT ... FOR UPDATE so two concurrent buyers of the last unit cannot
   * both pass the stock check.
   *
   * A missing product maps to `ErrProductNotFound`; losing the stock race (the
   * guarded UPDATE affects no row) maps to `ErrOutOfStock`; a missing machine
   * maps to `ErrMachineNotFound`. All statements share one transaction, so a
   * failure anywhere rolls back the whole purchase.
   */
  async commitPurchase(
    machineId: string,
    productId: string,
    record: PurchaseRecord,
    bankAfter: CoinBank,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const locked = await tx
        .select({ id: catalogProductsRef.id })
        .from(catalogProductsRef)
        .where(eq(catalogProductsRef.id, productId))
        .limit(1)
        .for("update");
      if (locked[0] === undefined) {
        throw ErrProductNotFound;
      }

      const decremented = await tx
        .update(catalogProductsRef)
        .set({ stock: sql`${catalogProductsRef.stock} - 1`, updatedAt: new Date() })
        .where(and(eq(catalogProductsRef.id, productId), gt(catalogProductsRef.stock, 0)))
        .returning({ id: catalogProductsRef.id });
      if (decremented.length === 0) {
        throw ErrOutOfStock;
      }

      const machine = await tx
        .update(machinesRef)
        .set({ coinBank: toJsonBank(bankAfter), updatedAt: new Date() })
        .where(eq(machinesRef.id, machineId))
        .returning({ id: machinesRef.id });
      if (machine.length === 0) {
        throw ErrMachineNotFound;
      }

      await tx.insert(salesPurchases).values({
        id: record.id,
        machineId: record.machineId,
        productId: record.productId,
        priceCents: record.priceCents,
        totalInsertedCents: record.totalInsertedCents,
        changeCents: record.changeCents,
        changeCoins: record.changeCoins,
        purchasedAt: record.purchasedAt,
      });
    });
  }
}
