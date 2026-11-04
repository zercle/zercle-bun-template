/**
 * The canonical owner of the hyphenated-UUID shape: one shape, one owner.
 *
 * Deliberately looser than zod's `z.uuid()`, which also enforces RFC 4122
 * variant bits and would reject ids the Go template's `validate:"uuid"` accepts.
 *
 * The wire contract (`features/sales/contract/purchase.ts`) keeps its own copy
 * because a contract is a dependency-free leaf and may not import `src/shared`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
