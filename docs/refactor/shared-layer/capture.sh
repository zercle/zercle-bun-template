#!/usr/bin/env bash
# Reproducible baseline/after capture for the shared-layer restructure.
#
# Runs every gate the project owns (lint, typecheck, unit, integration, e2e)
# plus the static structure metrics the refactor is measured on, and prints a
# single report. The same script produces `baseline.md` (before) and `after.md`
# (after); the diff between them is the evidence.
#
# Usage:
#   bash docs/refactor/shared-layer/capture.sh > baseline.md
#
# Env:
#   NODE_BIN     node binary used for Vitest (default: node, falling back to
#                /opt/homebrew/bin/node when `node` is a bun shim, which
#                breaks zod's CJS interop under Vitest).
#   DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_SSL_MODE
#   VALKEY_HOST VALKEY_PORT VALKEY_DB APP_ENVIRONMENT
#                required for the integration and e2e suites.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1

NODE_BIN="${NODE_BIN:-node}"
if ! "$NODE_BIN" --version 2>/dev/null | grep -qE '^v[0-9]'; then
  if [ -x /opt/homebrew/bin/node ]; then
    NODE_BIN=/opt/homebrew/bin/node
  else
    echo "capture: no real node runtime found (set NODE_BIN)" >&2
    exit 2
  fi
fi

DB_ENV=(
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-zercle_template_test}"
  DB_USER="${DB_USER:-postgres}"
  DB_PASSWORD="${DB_PASSWORD:-postgres}"
  DB_SSL_MODE="${DB_SSL_MODE:-disable}"
  VALKEY_HOST="${VALKEY_HOST:-127.0.0.1}"
  VALKEY_PORT="${VALKEY_PORT:-6379}"
  VALKEY_DB="${VALKEY_DB:-0}"
  APP_ENVIRONMENT="${APP_ENVIRONMENT:-test}"
)

# The unit suite runs WITHOUT the DB/VALKEY env vars: the config tests assert
# on the fixture file's values, and an ambient DB_HOST overrides them.
run_suite() {
  local name="$1" project="$2" with_db="$3"
  local log="/tmp/capture-$name.log"
  echo "### $name"
  if [ "$with_db" = "db" ]; then
    env "${DB_ENV[@]}" "$NODE_BIN" node_modules/vitest/vitest.mjs run --project "$project" > "$log" 2>&1
  else
    env -u DB_HOST -u DB_PORT -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_SSL_MODE \
      -u VALKEY_HOST -u VALKEY_PORT -u VALKEY_DB -u APP_ENVIRONMENT \
      "$NODE_BIN" node_modules/vitest/vitest.mjs run --project "$project" > "$log" 2>&1
  fi
  local code=$?
  grep -E 'Test Files|Tests  ' "$log" | sed 's/^/  /'
  if [ $code -ne 0 ]; then
    echo "  FAILING FILES:"
    grep -E 'FAIL' "$log" | sort -u | sed 's/^/  /'
  fi
  echo "  exit: $code"
  echo
}

echo "# Capture — $(git rev-parse --short HEAD) ($(git branch --show-current))"
echo
echo "node: $("$NODE_BIN" --version)"

echo
echo "## Gates"
echo
echo '### `bun run typecheck`'
bun run typecheck 2>&1 | tail -3 | sed 's/^/  /'
echo "  exit: ${PIPESTATUS[0]:-?}"
echo
echo '### `bun run lint`'
bun run lint 2>&1 | tail -3 | sed 's/^/  /'
echo "  exit: ${PIPESTATUS[0]:-?}"

echo
echo "## Suites"
echo
run_suite unit unit node
run_suite integration integration db
run_suite e2e e2e db

echo "## Structure metrics"
echo
echo "- src files (non-test): $(find src -name '*.ts' -not -name '*.test.ts' | wc -l | tr -d ' ')"
echo "- src files (all): $(find src -name '*.ts' | wc -l | tr -d ' ')"
echo "- src LOC (non-test): $(find src -name '*.ts' -not -name '*.test.ts' -exec cat {} + | wc -l | tr -d ' ')"
echo "- test LOC: $(find src test -name '*.test.ts' -exec cat {} + | wc -l | tr -d ' ')"
echo "- src LOC (non-test, code only): $(find src -name '*.ts' -not -name '*.test.ts' -exec cat {} + | grep -v '^[[:space:]]*$' | grep -v '^[[:space:]]*//' | grep -v '^[[:space:]]*\*' | grep -v '^[[:space:]]*/\*' | wc -l | tr -d ' ')"
echo "- UUID_RE definitions: $(grep -rn 'UUID_RE = ' src --include='*.ts' | grep -v '.test.ts' | wc -l | tr -d ' ')"
echo "- shared layer files: $(find src/shared -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')"
echo "- duplicated 6-line blocks: $(node docs/refactor/shared-layer/duplicates.mjs | tail -1)"
echo
echo '### facade exports (src/index.ts)'
node docs/refactor/shared-layer/facade-exports.mjs
