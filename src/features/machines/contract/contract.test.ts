/**
 * Contract tests: the wire schemas in `contract/` are the published inbound
 * API surface, so their accept/reject behavior is pinned here. Mirrors the Go
 * template's `contract/contract_test.go`.
 */
import { describe, expect, it } from "vitest";
import { CreateMachineRequest, MachineResponse } from "./create-machine.ts";
import { ListMachinesRequest, ListMachinesResponse, RestockBankRequest } from "./list-machines.ts";

describe("CreateMachineRequest", () => {
  it("accepts a valid label with and without coins", () => {
    expect(CreateMachineRequest.safeParse({ label: "lobby-1" }).success).toBe(true);
    expect(
      CreateMachineRequest.safeParse({ label: "lobby-1", initial_coins: [25, 100] }).success,
    ).toBe(true);
  });

  it("rejects a missing or empty label", () => {
    expect(CreateMachineRequest.safeParse({}).success).toBe(false);
    expect(CreateMachineRequest.safeParse({ label: "" }).success).toBe(false);
  });

  it("rejects non-positive or non-integer initial coins", () => {
    expect(CreateMachineRequest.safeParse({ label: "l", initial_coins: [0] }).success).toBe(false);
    expect(CreateMachineRequest.safeParse({ label: "l", initial_coins: [-5] }).success).toBe(false);
    expect(CreateMachineRequest.safeParse({ label: "l", initial_coins: [1.5] }).success).toBe(
      false,
    );
  });
});

describe("RestockBankRequest", () => {
  it("accepts a non-empty array of positive integer coins", () => {
    expect(RestockBankRequest.safeParse({ coins: [25, 25, 50] }).success).toBe(true);
  });

  it("rejects a missing or empty coins array", () => {
    expect(RestockBankRequest.safeParse({}).success).toBe(false);
    expect(RestockBankRequest.safeParse({ coins: [] }).success).toBe(false);
  });

  it("rejects non-positive coins", () => {
    expect(RestockBankRequest.safeParse({ coins: [0] }).success).toBe(false);
    expect(RestockBankRequest.safeParse({ coins: [-5] }).success).toBe(false);
  });
});

describe("ListMachinesRequest", () => {
  it("accepts empty pagination (both fields optional)", () => {
    const parsed = ListMachinesRequest.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts non-negative integer pagination", () => {
    expect(ListMachinesRequest.safeParse({ limit: 20, offset: 40 }).success).toBe(true);
    expect(ListMachinesRequest.safeParse({ limit: 500 }).success).toBe(true);
  });

  it("rejects negative or non-integer pagination", () => {
    expect(ListMachinesRequest.safeParse({ limit: -1 }).success).toBe(false);
    expect(ListMachinesRequest.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(ListMachinesRequest.safeParse({ offset: -1 }).success).toBe(false);
  });
});

describe("MachineResponse / ListMachinesResponse", () => {
  it("parses a wire-shaped payload with a string-keyed coin bank", () => {
    const machine = {
      id: "11111111-1111-4111-8111-111111111111",
      label: "lobby-1",
      coin_bank: { "5": 2, "25": 1 },
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };
    expect(MachineResponse.safeParse(machine).success).toBe(true);
    expect(ListMachinesResponse.safeParse({ machines: [machine] }).success).toBe(true);
  });

  it("rejects payloads missing fields", () => {
    expect(MachineResponse.safeParse({ id: "x" }).success).toBe(false);
  });
});
