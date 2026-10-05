/**
 * Use-case orchestration for the machines feature: validates input, applies the
 * domain entity, persists via the outbound repository, and maps results to the wire
 * contract. Depends only on `domain`, `repository`, and `contract`.
 */
import type { CreateMachineRequest, MachineResponse } from "../contract/create-machine.ts";
import type {
  ListMachinesRequest,
  ListMachinesResponse,
  RestockBankRequest,
} from "../contract/list-machines.ts";
import { ErrInvalidID, ErrInvalidMachineLabel } from "../domain/errors.ts";
import { addCoins, type Machine, validateCoins } from "../domain/machine.ts";
import type { MachineRepository } from "../repository/repository.ts";
import type { MachineService } from "./service.ts";

const defaultPageSizeFallback = 20;
const maxPageSizeFallback = 100;
const maxLabelLengthFallback = 255;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map a domain entity to its wire representation (RFC3339 timestamps). */
function toMachineResponse(machine: Machine): MachineResponse {
  return {
    id: machine.id,
    label: machine.label,
    // CoinBank keys are numeric in the domain but JSON object keys are strings.
    coin_bank: Object.fromEntries(Object.entries(machine.coinBank)),
    created_at: machine.createdAt.toISOString(),
    updated_at: machine.updatedAt.toISOString(),
  };
}

export interface MachineServiceLimits {
  defaultPageSize: number;
  maxPageSize: number;
  maxLabelLength: number;
}

export class MachineUsecase implements MachineService {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;
  private readonly maxLabelLength: number;

  constructor(
    private readonly repo: MachineRepository,
    limits: MachineServiceLimits,
  ) {
    // Pass <= 0 to use the built-in defaults (20/100/255), mirroring Go.
    this.defaultPageSize =
      limits.defaultPageSize > 0 ? limits.defaultPageSize : defaultPageSizeFallback;
    this.maxPageSize = limits.maxPageSize > 0 ? limits.maxPageSize : maxPageSizeFallback;
    this.maxLabelLength =
      limits.maxLabelLength > 0 ? limits.maxLabelLength : maxLabelLengthFallback;
  }

  async create(req: CreateMachineRequest): Promise<MachineResponse> {
    const label = req.label.trim();
    // Count by Unicode code points (matches Go's utf8.RuneCountInString).
    // `label.length` would count UTF-16 code units and split surrogate pairs.
    const codePointCount = [...label].length;
    if (codePointCount === 0 || codePointCount > this.maxLabelLength) {
      throw ErrInvalidMachineLabel;
    }
    const initialCoins = req.initial_coins ?? [];
    if (initialCoins.length > 0) {
      validateCoins(initialCoins);
    }
    const now = new Date();
    const machine: Machine = {
      id: crypto.randomUUID(),
      label,
      coinBank: addCoins({}, initialCoins),
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(machine);
    return toMachineResponse(machine);
  }

  async get(id: string): Promise<MachineResponse> {
    return toMachineResponse(await this.repo.getById(id));
  }

  async list(req: ListMachinesRequest): Promise<ListMachinesResponse> {
    let { limit = 0, offset = 0 } = req;
    // An unset/zero limit (i.e. no query parameter) never produces LIMIT 0.
    if (limit <= 0) {
      limit = this.defaultPageSize;
    }
    if (limit > this.maxPageSize) {
      limit = this.maxPageSize;
    }
    if (offset < 0) {
      offset = 0;
    }
    const machines = await this.repo.list(limit, offset);
    return { machines: machines.map(toMachineResponse) };
  }

  /**
   * RestockBank validates the coins, applies them to the machine's bank through
   * the repository, and re-reads the machine to return its authoritative bank.
   *
   * The re-read is deliberate: the repository port adds the coins inside one
   * locked transaction so concurrent restocks cannot lose an update, and the
   * resulting bank is only knowable from the datastore. Returning the bank from
   * this fresh read keeps the response consistent with what a later read returns
   * rather than echoing a locally composed map that a concurrent writer may have
   * already superseded.
   */
  async restockBank(id: string, req: RestockBankRequest): Promise<MachineResponse> {
    if (!UUID_RE.test(id)) {
      throw ErrInvalidID;
    }
    validateCoins(req.coins);
    await this.repo.restockBank(id, req.coins);
    return toMachineResponse(await this.repo.getById(id));
  }
}
