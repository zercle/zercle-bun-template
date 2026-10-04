/**
 * Inbound (driving) port of the machines feature.
 *
 * Driving adapters under `adapter/in` consume this interface; the use-case
 * implementation lives in `usecase.ts`. Methods speak the wire contract, so
 * adapters never touch the domain directly.
 */
import type { CreateMachineRequest, MachineResponse } from "../contract/create-machine.ts";
import type {
  ListMachinesRequest,
  ListMachinesResponse,
  RestockBankRequest,
} from "../contract/list-machines.ts";

export interface MachineService {
  create(req: CreateMachineRequest): Promise<MachineResponse>;
  get(id: string): Promise<MachineResponse>;
  list(req: ListMachinesRequest): Promise<ListMachinesResponse>;
  restockBank(id: string, req: RestockBankRequest): Promise<MachineResponse>;
}
