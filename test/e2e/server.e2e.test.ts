/**
 * End-to-end smoke test for the server.
 *
 * The server is launched as a real subprocess (`bun run src/main.ts`) and driven
 * over HTTP. Subprocess boot is required because Vitest runs this file under its
 * Node runtime, where the `Bun` global does not exist; the in-process
 * `Bun.serve` call in the composition root would throw `ReferenceError`. Spawning
 * the binary exercises the real process boundary: config load, live PostgreSQL +
 * Valkey wiring, migrations already applied by CI.
 *
 * The child listens on 127.0.0.1:8091 so a developer's dev server on 8080 is
 * never disturbed. The suite skips when `DB_HOST`/`VALKEY_HOST` are unset so unit
 * CI does not need docker services.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CHILD_HOST = "127.0.0.1";
const CHILD_PORT = 8091;
const CHILD_URL = `http://${CHILD_HOST}:${CHILD_PORT}`;

const HAS_DB = typeof process.env.DB_HOST === "string" && process.env.DB_HOST.length > 0;
const HAS_VALKEY =
  typeof process.env.VALKEY_HOST === "string" && process.env.VALKEY_HOST.length > 0;
const LIVE = HAS_DB && HAS_VALKEY;

const READY_TIMEOUT_MS = 15_000;
const READY_INTERVAL_MS = 250;
const KILL_GRACE_MS = 3_000;

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

interface MachineSales {
  machine_id: string;
  label: string;
  purchase_count: number;
  revenue_cents: number;
}

interface SummaryResponse {
  catalog: { product_count: number; total_stock: number };
  machines: { machine_count: number; total_coin_bank_cents: number };
  sales: { purchase_count: number; revenue_cents: number };
  top_machines: MachineSales[];
}

describe.skipIf(!LIVE)("server e2e — vending demo", () => {
  const runSuffix = `${process.pid}-${Date.now()}`;
  let child: ChildProcess | undefined;
  let output = "";
  let spawnError: Error | undefined;
  let productId: string;
  let machineId: string;

  function outputTail(): string {
    return output.length > 0 ? output.slice(-2_000) : "(no output captured)";
  }

  async function waitForHealthy(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`failed to spawn server: ${spawnError.message}`);
      }
      if (child && child.exitCode !== null) {
        throw new Error(
          `server exited with code ${child.exitCode} before becoming ready\n${outputTail()}`,
        );
      }
      try {
        const res = await fetch(`${CHILD_URL}/healthz`);
        if (res.status === 200) return;
      } catch {
        // Server not accepting connections yet; retry until the deadline.
      }
      await new Promise((resolve) => setTimeout(resolve, READY_INTERVAL_MS));
    }
    throw new Error(`server did not become healthy within ${READY_TIMEOUT_MS}ms\n${outputTail()}`);
  }

  beforeAll(async () => {
    child = spawn("bun", ["run", "src/main.ts"], {
      cwd: REPO_ROOT,
      env: { ...process.env, HTTP_PORT: String(CHILD_PORT), HTTP_HOST: CHILD_HOST },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      output += chunk;
    });
    child.on("error", (err) => {
      spawnError = err;
    });

    await waitForHealthy();
  });

  afterAll(async () => {
    if (!child || child.exitCode !== null) return;
    const proc = child;
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        proc.kill("SIGKILL");
      }, KILL_GRACE_MS);
      proc.once("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });
      proc.kill("SIGTERM");
    });
  });

  async function post(path: string, json: unknown): Promise<Response> {
    return fetch(`${CHILD_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(json),
    });
  }

  it("creates a catalog product and reads it back", async () => {
    const name = `e2e-cola-${runSuffix}`;
    const createRes = await post("/api/v1/products", {
      name,
      price_cents: 75,
      stock: 5,
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as ProductResponse;
    expect(created.id).toBeTruthy();
    expect(created.price_cents).toBe(75);
    expect(created.stock).toBe(5);
    productId = created.id;

    const getRes = await fetch(`${CHILD_URL}/api/v1/products/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as ProductResponse;
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(name);
  });

  it("registers a machine with an initial coin bank and restocks it", async () => {
    const createRes = await post("/api/v1/machines", {
      label: `e2e-machine-${runSuffix}`,
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

  // Reporting runs after the purchases above so the summary has rows to
  // aggregate. Totals are asserted with `>=` because earlier e2e runs may
  // leave rows behind; the machine's own leaderboard row is identified by id
  // and asserted exactly. `top=20` is the configured max_top_machines, which
  // keeps this suite's machine in the leaderboard regardless of leftovers.
  it("reports cross-feature totals and the top machines by revenue", async () => {
    const res = await fetch(`${CHILD_URL}/api/v1/reports/summary?top=20`);
    expect(res.status).toBe(200);
    const summary = (await res.json()) as SummaryResponse;

    expect(summary.catalog.product_count).toBeGreaterThanOrEqual(1);
    expect(summary.catalog.total_stock).toBeGreaterThanOrEqual(1);
    expect(summary.machines.machine_count).toBeGreaterThanOrEqual(1);
    expect(summary.machines.total_coin_bank_cents).toBeGreaterThanOrEqual(0);
    expect(summary.sales.purchase_count).toBeGreaterThanOrEqual(1);
    expect(summary.sales.revenue_cents).toBeGreaterThanOrEqual(75);

    const ours = summary.top_machines.find((m) => m.machine_id === machineId);
    expect(ours).toBeDefined();
    expect(ours?.label).toBe(`e2e-machine-${runSuffix}`);
    expect(ours?.purchase_count).toBe(1);
    expect(ours?.revenue_cents).toBe(75);
  });

  it("returns a 400 envelope for a negative top query parameter", async () => {
    const res = await fetch(`${CHILD_URL}/api/v1/reports/summary?top=-1`);
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
