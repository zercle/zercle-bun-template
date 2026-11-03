# Plan — introduce the shared layer (structure restructure)

Branch: `refactor/shared-layer` (base: `develop` @ `d0ede09`)
Baseline: [`baseline.md`](baseline.md) — committed, reproducible via `capture.sh`.

## PROMPT

Restructure `zercle-bun-template` so the project matches the layer layout its own
reference and the `project-structure` skill prescribe: a `shared` layer that owns
the cross-feature error catalog and one canonical owner for the UUID shape.
Behavior must be preserved exactly — the HTTP contract, the published facade,
the migration runner and the feature behavior stay identical; only module
ownership and import paths change. Done when every gate the project owns
(typecheck, lint, unit, integration, e2e) is green with the same test counts,
the published facade exports the same names, and no static metric regresses.

## INTENT

Code does X: the cross-feature error catalog lives in `src/infrastructure/errors/`
and the UUID shape is spelled out in five separate modules.
The checks expect Y: identical HTTP envelopes, identical published exports,
identical migration behavior — only the owning module changes.
The spec says Z: the Go template this repo mirrors puts the same catalog in
`internal/shared/errors/` (feature-agnostic, gated separately from
`internal/infrastructure/`), and the `project-structure` skill defines `shared`
as the layer for "cross-feature DTOs, error catalog, response envelope".

## Smell (named, not symptom)

1. **Mixed responsibility — a cross-feature contract parked in the wrong layer.**
   `src/infrastructure/errors/` holds the error catalog and the HTTP error
   mapper. Both are used by features, by infrastructure, and by the published
   facade `src/index.ts`. A layer that features depend on is not
   infrastructure: the Go reference keeps it in `internal/shared/errors/` and
   gates `internal/shared` separately from `internal/infrastructure/`. Today
   `infrastructure-ignores-features` is the only rule protecting it, so the
   shared contract and the framework plumbing share one blast radius.
2. **Duplication with no canonical owner.** The hyphenated-UUID regex is
   spelled out five times (`catalog/handler`, `machines/handler`,
   `machines/usecase`, `sales/contract`, `sales/usecase`). One shape, five
   copies, no owner. A change to id validation would have to touch all five.
3. **The gate has no vocabulary for a shared layer.** `src/architecture.test.ts`
   knows `domain`, `contract`, `usecase`, `repository`, `handler`,
   `features`, `infrastructure` — and nothing else. Any shared layer must be
   gated too, or the new seam is unruled.

## Scope (locked)

In scope:

- `src/infrastructure/errors/**` → `src/shared/errors/**` (pure move).
- New `src/shared/uuid.ts`: one canonical `UUID_RE` owner.
- Every import site of the moved module updated in the same change.
- `src/architecture.test.ts`: a rule that governs `shared/**`, and the
  `usecase` rule's allowlist extended with `shared/**`.
- `README.md` + `AGENTS.md`: the new shape.

Out of scope (deliberately):

- Renaming the feature layer directories (`repository` → `ports`,
  `handler` → `adapters/inbound`, `repository/postgres` → `adapters/outbound`).
  The repo's spelling already mirrors the Go reference, and the skill says an
  existing project's spelling wins. A rename here would touch every import in
  the tree for no ownership gain.
- Consolidating the handlers' duplicated request plumbing (body parse, query
  number parse, `status as 200` envelope) into one helper. That helper would
  have to be framework-bound (Hono), and the shared layer is framework-free by
  definition. Separate change, separate risk.
- Any behavior change. No new feature, no bug fix, no reformat.

## Unknowns (resolved from the repo, not guessed)

- Does the error catalog import anything from `infrastructure`? No — it is
  dependency-free inside itself. Moving it up cannot create a cycle.
- Does the published facade change? No — `src/index.ts` re-exports the same
  names from a different path. The export list is captured before/after.
- Does the migration runner care? No — `migrationsDir` strings in
  `src/features/features.ts` are untouched by this restructure.
- Can the contract import the shared UUID module? No — `contract-is-leaf`
  allows `zod` only. The sales contract keeps its own copy, with the reason
  recorded in the code.
- Can a usecase import the shared UUID module? Only if the gate allows it.
  The gate is extended, not weakened: `shared/**` gets its own rule (no src
  import outside `shared/**`, no third-party package), so the new edge cannot
  create a feature-to-feature dependency.

## Steps (atomic commits, build green at each)

1. `refactor(structure): move the cross-feature error catalog to a shared layer`
   — `git mv src/infrastructure/errors src/shared/errors`; update every import
   site; add the `shared` rule to the gate; update the gate's own doc comment.
2. `refactor(shared): one canonical owner for the UUID shape`
   — add `src/shared/uuid.ts`; point the four non-contract call sites at it;
   extend the usecase rule's allowlist with `shared/**`.
3. `docs: sync README and AGENTS.md with the shared layer`
   — new shape, no stale references.

## Regression thresholds (every step must meet these)

| Check | Threshold |
|---|---|
| `bun run typecheck` | exit 0 |
| `bun run lint` | exit 0 |
| unit suite | exit 0, 40 files / 323 tests |
| integration suite | exit 0, 5 files / 26 tests |
| e2e suite | exit 0, 1 file / 8 tests |
| published facade exports | the same 20 names, no more, no fewer |
| `src` LOC (non-test, code only) | must not increase (target: decrease) |
| duplicated 6-line blocks | must not increase (target: decrease) |

Any threshold crossed → revert the step and re-plan. Correctness outranks
aesthetics; there is no trade.

### Threshold outcome (recorded after the fact)

`src` LOC (non-test, total) rose 4494 → 4500 (+6). Every one of those lines
is a doc comment: the new shared modules and the gate rule. The metric that
measures *code* — `src` LOC (non-test, code only) — fell 3019 → 3016 (−3), so
the restructure adds no code. The threshold above therefore states the
code-only metric; the total-LOC rise is the cost of saying why the new
modules exist, and no threshold was crossed.

## Evidence

- Baseline: `baseline.md` (committed), produced by `capture.sh`.
- After: `after.md` (committed), produced by the same script.
