/**
 * The canonical owner of the hyphenated-UUID shape.
 *
 * One shape, one owner: the feature handlers and use cases that validate an
 * id against this regex used to spell out their own copy, so a change to id
 * validation would have had to touch every one of them.
 *
 * Deliberately looser than zod's `z.uuid()`, which also enforces RFC 4122
 * variant bits and would reject ids the Go template's `validate:"uuid"` accepts.
 *
 * The wire contract (`features/sales/contract/purchase.ts`) keeps its own copy
 * on purpose: a contract is a dependency-free leaf and may not import from
 * `src/shared`.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
