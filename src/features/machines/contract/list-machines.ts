/**
 * Pagination and restock wire types for the machines feature's `/api/v1`
 * endpoints. See `create-machine.ts` for the contract-module ground rules.
 */
import { z } from "zod";
import { MachineResponse } from "./create-machine.ts";

/**
 * ListMachinesRequest carries pagination parameters for listing machines,
 * bound from the GET query string. The upper page-size limit is
 * deployment-configurable and enforced in the usecase layer, so a hardcoded
 * max here would drift.
 */
export const ListMachinesRequest = z.object({
  limit: z.number().int().min(0).optional(),
  offset: z.number().int().min(0).optional(),
});

/** ListMachinesResponse wraps a page of machines. */
export const ListMachinesResponse = z.object({
  machines: z.array(MachineResponse),
});

/**
 * RestockBankRequest is the payload for adding coins to a machine's bank.
 * Coins are validated structurally (at least one, positive); the domain layer
 * rejects values that are not accepted denominations because the accepted set
 * is a domain fact, not a wire fact.
 */
export const RestockBankRequest = z.object({
  coins: z.array(z.number().int().positive()).min(1),
});

export type ListMachinesRequest = z.infer<typeof ListMachinesRequest>;
export type ListMachinesResponse = z.infer<typeof ListMachinesResponse>;
export type RestockBankRequest = z.infer<typeof RestockBankRequest>;
