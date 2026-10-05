/**
 * Driven adapter: Drizzle/Postgres persistence for `Machine` entities.
 * Satisfies the feature's `MachineRepository` interface structurally and translates
 * between storage rows and domain entities.
 */
import { desc, eq } from "drizzle-orm";
import type { DB } from "../../../../infrastructure/db/index.ts";
import { ErrMachineNotFound } from "../../domain/errors.ts";
import { addCoins, type Machine } from "../../domain/machine.ts";
import type { MachineRepository } from "../repository.ts";
import { bankFromJson, bankToJson, machines, type NewMachineRow } from "./schema.ts";

export class DrizzleMachineRepository implements MachineRepository {
  constructor(private readonly db: DB) {}

  async create(machine: Machine): Promise<Machine> {
    const row: NewMachineRow = {
      id: machine.id,
      label: machine.label,
      coinBank: bankToJson(machine.coinBank),
      createdAt: machine.createdAt,
      updatedAt: machine.updatedAt,
    };
    await this.db.insert(machines).values(row);
    return machine;
  }

  async getById(id: string): Promise<Machine> {
    const rows = await this.db.select().from(machines).where(eq(machines.id, id)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      throw ErrMachineNotFound;
    }
    return {
      id: row.id,
      label: row.label,
      coinBank: bankFromJson(row.coinBank),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(limit: number, offset: number): Promise<Machine[]> {
    const rows = await this.db
      .select()
      .from(machines)
      .orderBy(desc(machines.createdAt), desc(machines.id))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      coinBank: bankFromJson(row.coinBank),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async restockBank(id: string, coins: number[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(machines)
        .where(eq(machines.id, id))
        .for("update")
        .limit(1);
      const row = rows[0];
      if (row === undefined) {
        throw ErrMachineNotFound;
      }
      const bankAfter = addCoins(bankFromJson(row.coinBank), coins);
      await tx
        .update(machines)
        .set({ coinBank: bankToJson(bankAfter), updatedAt: new Date() })
        .where(eq(machines.id, id));
    });
  }
}
