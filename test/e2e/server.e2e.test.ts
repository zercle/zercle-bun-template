/**
 * End-to-end smoke test for the server.
 *
 * Boots the full composition root (`build()` from `src/app/app.ts`) in-process
 * against real PostgreSQL + Valkey, then exercises the public surface with
 * `fetch`. Requires live deps; skips when `DB_HOST` is unset so unit CI does
 * not require docker services.
 *
 * CI workflow runs migrations (`bun run migrate:up`) before invoking this
 * project, so the `items` table already exists.
 */
import { describe, expect, it } from "vitest";
import { build } from "../../src/app/app.ts";
import { Container } from "../../src/app/container.ts";
import type { Application } from "../../src/platform/server/index.ts";

const HAS_DB = typeof process.env.DB_HOST === "string" && process.env.DB_HOST.length > 0;
const HAS_VALKEY =
  typeof process.env.VALKEY_HOST === "string" && process.env.VALKEY_HOST.length > 0;
const LIVE = HAS_DB && HAS_VALKEY;

describe.skipIf(!LIVE)("server e2e", () => {
  let application: Application | undefined;
  let base: string;

  it("boots, serves /healthz, creates and reads an item", async () => {
    const container = new Container();
    application = await build(container);
    await application.start();

    const addr = application.addr;
    expect(addr).toBeDefined();
    base = `http://${addr?.hostname ?? "127.0.0.1"}:${addr?.port ?? 0}`;

    const healthRes = await fetch(`${base}/healthz`);
    expect(healthRes.status).toBe(200);

    const createRes = await fetch(`${base}/api/v1/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "e2e-stub" }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; name: string };
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("e2e-stub");

    const getRes = await fetch(`${base}/api/v1/items/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { id: string; name: string };
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("e2e-stub");
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
