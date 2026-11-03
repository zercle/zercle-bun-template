# Capture — 9826fad (refactor/shared-layer)

node: v26.13.0

## Gates

### `bun run typecheck`
  $ tsc --noEmit
  exit: 0

### `bun run lint`
  $ biome check src test
  Checked 129 files in 28ms. No fixes applied.
  exit: 0

## Suites

### unit
   Test Files  40 passed (40)
        Tests  323 passed (323)
  exit: 0

### integration
   Test Files  5 passed (5)
        Tests  26 passed (26)
  exit: 0

### e2e
   Test Files  1 passed (1)
        Tests  8 passed (8)
  exit: 0

## Structure metrics

- src files (non-test): 83
- src files (all): 128
- src LOC (non-test): 4505
- test LOC: 7156
- UUID_RE definitions: 2
- shared layer files: 6
- duplicated 6-line blocks: total duplicated 6-line blocks: 51

### facade exports (src/index.ts)
AppType
CreateMachineRequest
CreateProductRequest
ErrCodeCanceled
ErrCodeConflict
ErrCodeDeadlineExceeded
ErrCodeForbidden
ErrCodeInternal
ErrCodeInvalidInput
ErrCodeNotFound
ErrCodeUnauthorized
ListMachinesRequest
ListMachinesResponse
ListProductsRequest
ListProductsResponse
MachineResponse
ProductResponse
PurchaseRequest
PurchaseResponse
RestockBankRequest

total exported names: 20
