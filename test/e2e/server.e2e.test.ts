/**
 * End-to-end smoke test for the server.
 *
 * Boots the full composition root (`build()` from `src/app/app.ts`) in-process
 * against real PostgreSQL + Valkey, then exercises the vending demo across the
 * three features: create a catalog product, register a machine with a coin
 * bank, restock it, then buy the product and check the change math and error
 * envelopes. Requires live deps; skips when `DB_HOST`/`VALKEY_HOST` are unset
 * so unit CI does not require docker services.
 *
 * CI runs `bun run migrate:up` before this project, so the feature tables
 * already exist.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "../../src/app/app.ts";
import { Container } from "../../src/app/container.ts";
import type { Application } from "../../src/platform/server/index.ts";

const HAS_DB = typeof process.env.DB_HOST === "string" && process.env.DB_HOST.length > 0;
const HAS_VALKEY =
  typeof process.env.VALKEY_HOST === "string" && process.env.VALKEY_HOST.length > 0;
const LIVE = HAS_DB && HAS_VALKEY;

interface ProductResponse {
  id: string;
  name: string;
  price_cents: number;
  stock: number;
}

interface MachineResponse {
  id: string;
  label: string;
  coin_bank: Record<string, number>;
}

interface PurchaseResponse {
  id: string;
  machine_id: string;
  product_id: string;
  price_cents: number;
  total_inserted_cents: number;
  change_cents: number;
  change_coins: number[];
}

interface ErrorEnvelope {
  error: string;
  message: string;
}

describe.skipIf(!LIVE)("server e2e — vending demo", () => {
  let application: Application | undefined;
  let base: string;
  let productId: string;
  let machineId: string;

  beforeAll(async () => {
    const container = new Container();
    application = await build(container);
    await application.start();
    const addr = application.addr;
    base = `http://${addr?.hostname ?? "127.0.0.1"}:${addr?.port ?? 0}`;
  });

  afterAll(async () => {
    await application?.stop();
  });

  async function post(path: string, json: unknown): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(json),
    });
  }

  it("creates a catalog product and reads it back", async () => {
    const createRes = await post("/api/v1/products", {
      name: "e2e-cola",
      price_cents: 75,
      stock: 5,
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as ProductResponse;
    expect(created.id).toBeTruthy();
    expect(created.price_cents).toBe(75);
    expect(created.stock).toBe(5);
    productId = created.id;

    const getRes = await fetch(`${base}/api/v1/products/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as ProductResponse;
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("e2e-cola");
  });

  it("registers a machine with an initial coin bank and restocks it", async () => {
    const createRes = await post("/api/v1/machines", {
      label: "e2e-machine",
      initial_coins: [10],
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as MachineResponse;
    expect(created.id).toBeTruthy();
    expect(created.coin_bank["10"]).toBe(1);
    machineId = created.id;

    const restockRes = await post(`/api/v1/machines/${created.id}/bank`, {
      coins: [25, 25],
    });
    expect(restockRes.status).toBe(200);
    const restocked = (await restockRes.json()) as MachineResponse;
    expect(restocked.coin_bank["10"]).toBe(1);
    expect(restocked.coin_bank["25"]).toBe(2);
  });

  it("purchases with correct price and change math", async () => {
    const res = await post("/api/v1/purchases", {
      machine_id: machineId,
      product_id: productId,
      coins: [100],
    });
    expect(res.status).toBe(201);
    const purchase = (await res.json()) as PurchaseResponse;
    expect(purchase.machine_id).toBe(machineId);
    expect(purchase.product_id).toBe(productId);
    expect(purchase.price_cents).toBe(75);
    expect(purchase.total_inserted_cents).toBe(100);
    expect(purchase.change_cents).toBe(25);
    expect(purchase.change_coins).toEqual([25]);
  });

  it("returns a 404 envelope for an unknown product id", async () => {
    const res = await post("/api/v1/purchases", {
      machine_id: machineId,
      product_id: crypto.randomUUID(),
      coins: [100],
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error).toBe("NOT_FOUND");
  });

  it("returns a 400 envelope for insufficient payment", async () => {
    const res = await post("/api/v1/purchases", {
      machine_id: machineId,
      product_id: productId,
      coins: [5],
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorEnvelope;
    expect(body.error).toBe("INVALID_INPUT");
  });
});

describe("server e2e (skipped without live deps)", () => {
  it("is skipped when DB_HOST or VALKEY_HOST is unset", () => {
    if (LIVE) {
      // When live, the previous describe owns the assertions.
      expect(true).toBe(true);
      return;
    }
    expect(typeof HAS_DB === "boolean").toBe(true);
    expect(typeof HAS_VALKEY === "boolean").toBe(true);
  });
});
