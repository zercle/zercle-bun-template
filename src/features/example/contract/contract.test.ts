// STUB FEATURE — delete src/features/example to start your project.

/**
 * Contract tests: the wire schemas in `contract/` are the published inbound
 * API surface, so their accept/reject behavior is pinned here. Mirrors the
 * Go template's `contract/contract_test.go`.
 */
import { describe, expect, it } from "vitest";
import { CreateItemRequest, ItemResponse } from "./create-item.ts";
import { ListItemsRequest, ListItemsResponse } from "./list-items.ts";

describe("CreateItemRequest", () => {
  it("accepts a valid name", () => {
    const parsed = CreateItemRequest.safeParse({ name: "hello" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a missing or empty name", () => {
    expect(CreateItemRequest.safeParse({}).success).toBe(false);
    expect(CreateItemRequest.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects non-string names", () => {
    expect(CreateItemRequest.safeParse({ name: 42 }).success).toBe(false);
  });
});

describe("ListItemsRequest", () => {
  it("accepts empty pagination (both fields optional)", () => {
    const parsed = ListItemsRequest.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts integer pagination in range", () => {
    expect(ListItemsRequest.safeParse({ limit: 20, offset: 40 }).success).toBe(true);
  });

  it("rejects out-of-range or non-integer pagination", () => {
    expect(ListItemsRequest.safeParse({ limit: 101 }).success).toBe(false);
    expect(ListItemsRequest.safeParse({ limit: -1 }).success).toBe(false);
    expect(ListItemsRequest.safeParse({ limit: 1.5 }).success).toBe(false);
    expect(ListItemsRequest.safeParse({ offset: -1 }).success).toBe(false);
  });
});

describe("ItemResponse / ListItemsResponse", () => {
  it("parses a wire-shaped payload", () => {
    const item = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "hello",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };
    expect(ItemResponse.safeParse(item).success).toBe(true);
    expect(ListItemsResponse.safeParse({ items: [item] }).success).toBe(true);
  });

  it("rejects payloads missing fields", () => {
    expect(ItemResponse.safeParse({ id: "x" }).success).toBe(false);
  });
});
