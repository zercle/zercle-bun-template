import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidInput, ErrNotFound } from "../../../../../platform/errors/app-error.ts";
import { registerSentinel } from "../../../../../platform/errors/sentinel.ts";
import type { MachineService } from "../../../application/service.ts";
import type { MachineResponse } from "../../../contract/create-machine.ts";
import type { ListMachinesResponse } from "../../../contract/list-machines.ts";
import {
  ErrInvalidID,
  ErrInvalidMachineLabel,
  ErrMachineNotFound,
  ErrUnsupportedCoin,
} from "../../../domain/errors.ts";
import { createMachinesRouter } from "./handler.ts";

const UUID = "11111111-1111-4111-8111-111111111111";

function fixedResponse(label: string): MachineResponse {
  return {
    id: UUID,
    label,
    coin_bank: { "25": 2 },
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
}

function makeService(overrides: Partial<MachineService> = {}): MachineService {
  return {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    restockBank: vi.fn(),
    ...overrides,
  };
}

describe("machines router (HTTP)", () => {
  beforeAll(() => {
    registerSentinel(ErrMachineNotFound, ErrNotFound);
    registerSentinel(ErrInvalidID, ErrInvalidInput);
    registerSentinel(ErrInvalidMachineLabel, ErrInvalidInput);
    registerSentinel(ErrUnsupportedCoin, ErrInvalidInput);
  });

  let service: MachineService;
  let app: Hono;

  beforeEach(() => {
    service = makeService();
    app = new Hono();
    app.route("/", createMachinesRouter({ service }));
  });

  it("POST /machines with valid body -> 201 + machine response", async () => {
    vi.mocked(service.create).mockResolvedValueOnce(fixedResponse("m1"));

    const res = await app.request("/machines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "m1", initial_coins: [25, 25] }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(body.label).toBe("m1");
    expect(body.coin_bank).toEqual({ "25": 2 });
    expect(service.create).toHaveBeenCalledWith({ label: "m1", initial_coins: [25, 25] });
  });

  it("POST /machines with invalid JSON -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/machines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("POST /machines missing label -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/machines", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.create).not.toHaveBeenCalled();
  });

  it("GET /machines/:id with valid uuid -> 200 + machine", async () => {
    vi.mocked(service.get).mockResolvedValueOnce(fixedResponse("m1"));

    const res = await app.request(`/machines/${UUID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(UUID);
    expect(service.get).toHaveBeenCalledWith(UUID);
  });

  it("GET /machines/:id with invalid uuid -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/machines/not-a-uuid");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.get).not.toHaveBeenCalled();
  });

  it("GET /machines/:id not found -> 404 NOT_FOUND", async () => {
    vi.mocked(service.get).mockRejectedValueOnce(ErrMachineNotFound);

    const res = await app.request(`/machines/${UUID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("NOT_FOUND");
  });

  it("GET /machines -> 200 with machines array", async () => {
    const resp: ListMachinesResponse = { machines: [fixedResponse("a"), fixedResponse("b")] };
    vi.mocked(service.list).mockResolvedValueOnce(resp);

    const res = await app.request("/machines?limit=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { machines: Array<Record<string, unknown>> };
    expect(body.machines).toHaveLength(2);
    expect(body.machines[0]?.id).toBe(UUID);
    expect(service.list).toHaveBeenCalledWith({ limit: 10 });
  });

  it("POST /machines/:id/bank with valid body -> 200 + machine response", async () => {
    vi.mocked(service.restockBank).mockResolvedValueOnce(fixedResponse("m1"));

    const res = await app.request(`/machines/${UUID}/bank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coins: [25, 25] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.coin_bank).toEqual({ "25": 2 });
    expect(service.restockBank).toHaveBeenCalledWith(UUID, { coins: [25, 25] });
  });

  it("POST /machines/:id/bank with invalid uuid -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/machines/not-a-uuid/bank", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coins: [25] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.restockBank).not.toHaveBeenCalled();
  });

  it("POST /machines/:id/bank with unsupported coin -> 400 INVALID_INPUT", async () => {
    vi.mocked(service.restockBank).mockRejectedValueOnce(ErrUnsupportedCoin);

    const res = await app.request(`/machines/${UUID}/bank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coins: [7] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
  });

  it("POST /machines/:id/bank missing coins -> 400 INVALID_INPUT", async () => {
    const res = await app.request(`/machines/${UUID}/bank`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coins: [] }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.restockBank).not.toHaveBeenCalled();
  });
});
