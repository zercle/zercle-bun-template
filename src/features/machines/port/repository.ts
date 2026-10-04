/**
 * Outbound (driven) port of the machines feature: persistence of `Machine`
 * entities. The application layer consumes this interface; the Drizzle adapter
 * under `adapter/out/postgres` satisfies it structurally.
 */
import type { Machine } from "../domain/machine.ts";

export interface MachineRepository {
  create(machine: Machine): Promise<Machine>;
  getById(id: string): Promise<Machine>;
  list(limit: number, offset: number): Promise<Machine[]>;
  /**
   * RestockBank adds coins to the machine's coin bank inside one transaction,
   * locking the row so concurrent restocks cannot lose an update. A missing
   * machine maps to ErrMachineNotFound.
   */
  restockBank(id: string, coins: number[]): Promise<void>;
}
