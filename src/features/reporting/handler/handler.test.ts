/**
 * HTTP driving-adapter tests for the reporting feature. A fake
 * `ReportingService` stands in for the usecase layer so the router's query
 * parsing, status codes, and error envelope are exercised without a database.
 */
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrInvalidInput } from "../../../infrastructure/errors/app-error.ts";
import { registerSentinel } from "../../../infrastructure/errors/sentinel.ts";
import type { SummaryResponse } from "../contract/summary.ts";
import { ErrInvalidTopMachines } from "../domain/errors.ts";
import type { ReportingService } from "../usecase/service.ts";
import { createReportingRouter } from "./handler.ts";

const MACHINE_ID = "11111111-1111-4111-8111-111111111111";

function fixedResponse(): SummaryResponse {
  return {
    catalog: { product_count: 2, total_stock: 9 },
    machines: { machine_count: 1, total_coin_bank_cents: 125 },
    sales: { purchase_count: 3, revenue_cents: 300 },
    top_machines: [{ machine_id: MACHINE_ID, label: "A", purchase_count: 3, revenue_cents: 300 }],
  };
}

function makeService(overrides: Partial<ReportingService> = {}): ReportingService {
  return {
    summary: vi.fn(),
    ...overrides,
  };
}

describe("reporting router (HTTP)", () => {
  beforeAll(() => {
    registerSentinel(ErrInvalidTopMachines, ErrInvalidInput);
  });

  let service: ReportingService;
  let app: Hono;

  beforeEach(() => {
    service = makeService();
    app = new Hono();
    app.route("/", createReportingRouter({ service }));
  });

  it("GET /reports/summary?top=3 -> 200 + summary response", async () => {
    const resp = fixedResponse();
    vi.mocked(service.summary).mockResolvedValueOnce(resp);

    const res = await app.request("/reports/summary?top=3");

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.catalog).toEqual({ product_count: 2, total_stock: 9 });
    expect(body.top_machines).toEqual(resp.top_machines);
    expect(service.summary).toHaveBeenCalledWith({ top: 3 });
  });

  it("GET /reports/summary without top -> 200 and an absent top", async () => {
    vi.mocked(service.summary).mockResolvedValueOnce(fixedResponse());

    const res = await app.request("/reports/summary");

    expect(res.status).toBe(200);
    expect(service.summary).toHaveBeenCalledWith({});
  });

  it("GET /reports/summary?top=abc -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/reports/summary?top=abc");

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.summary).not.toHaveBeenCalled();
  });

  it("GET /reports/summary?top=-1 -> 400 INVALID_INPUT", async () => {
    const res = await app.request("/reports/summary?top=-1");

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
    expect(service.summary).not.toHaveBeenCalled();
  });

  it("maps ErrInvalidTopMachines to 400 INVALID_INPUT", async () => {
    vi.mocked(service.summary).mockRejectedValueOnce(ErrInvalidTopMachines);

    const res = await app.request("/reports/summary?top=21");

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("INVALID_INPUT");
  });
});
