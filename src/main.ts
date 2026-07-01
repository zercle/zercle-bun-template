/**
 * Composition root entry point. Mirrors Go `cmd/server/main.go`.
 *
 * Build metadata (overridable at build time via env or bundler defines):
 *   APP_VERSION   - semver/tag (default "dev")
 *   APP_COMMIT_SHA - git SHA (default "unknown")
 *   APP_BUILD_TIME - RFC3339 timestamp (default "unknown")
 */
import { run } from "./app/app.ts";

const VERSION = process.env.APP_VERSION ?? "dev";
const COMMIT_SHA = process.env.APP_COMMIT_SHA ?? "unknown";
const BUILD_TIME = process.env.APP_BUILD_TIME ?? "unknown";

console.log(
  JSON.stringify({
    msg: "starting",
    version: VERSION,
    commit: COMMIT_SHA,
    build_time: BUILD_TIME,
  }),
);

run().catch((err: unknown) => {
  console.error("server stopped with error:", err);
  process.exit(1);
});
